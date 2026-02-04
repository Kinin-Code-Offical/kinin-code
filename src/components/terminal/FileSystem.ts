import { TerminalFile } from "./types";

export interface FileSystemNode {
    name: string;
    type: "file" | "directory";
    content?: string;
    section?: string;
    children?: FileSystemNode[];
}

const splitPath = (path: string) =>
    path
        .split("/")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);

const normalizePath = (path: string) => {
    if (!path) {
        return "/";
    }
    const parts = splitPath(path);
    const stack: string[] = [];
    for (const part of parts) {
        if (part === ".") {
            continue;
        }
        if (part === "..") {
            stack.pop();
            continue;
        }
        stack.push(part);
    }
    return `/${stack.join("/")}`;
};

export class FileSystem {
    root: FileSystemNode;
    cwd: string;
    homePath: string;

    constructor(files: TerminalFile[], homePath: string, cwd: string = homePath) {
        this.root = { name: "/", type: "directory", children: [] };
        this.homePath = normalizePath(homePath);
        this.cwd = normalizePath(cwd);
        this.buildTree(files);
    }

    private buildTree(files: TerminalFile[]) {
        files.forEach((file) => {
            const normalized = normalizePath(file.path);
            const parts = splitPath(normalized);
            if (!parts.length) {
                return;
            }
            let node = this.root;
            parts.forEach((part, index) => {
                const isLast = index === parts.length - 1;
                const children = node.children ?? [];
                let next = children.find((child) => child.name === part);
                if (!next) {
                    next = {
                        name: part,
                        type: isLast && file.type !== "dir" ? "file" : "directory",
                        children: [],
                    };
                    children.push(next);
                    node.children = children;
                }
                if (isLast && next.type === "file") {
                    next.content = file.content ?? "";
                    next.section = file.section;
                }
                node = next;
            });
        });
    }

    resolvePath(input: string) {
        if (!input || input === ".") {
            return this.cwd;
        }
        if (input.startsWith("~")) {
            return normalizePath(`${this.homePath}${input.slice(1)}`);
        }
        if (input.startsWith("/")) {
            return normalizePath(input);
        }
        return normalizePath(`${this.cwd}/${input}`);
    }

    private findNode(path: string) {
        const normalized = normalizePath(path);
        const parts = splitPath(normalized);
        let node: FileSystemNode = this.root;
        for (const part of parts) {
            if (!node.children) {
                return null;
            }
            const next = node.children.find((child) => child.name === part);
            if (!next) {
                return null;
            }
            node = next;
        }
        return node;
    }

    getNode(path: string) {
        return this.findNode(this.resolvePath(path));
    }

    private getParent(path: string) {
        const normalized = normalizePath(path);
        const parts = splitPath(normalized);
        const name = parts.pop();
        if (!name) {
            return null;
        }
        const parentPath = `/${parts.join("/")}`;
        const parent = parts.length ? this.findNode(parentPath) : this.root;
        if (!parent || parent.type !== "directory") {
            return null;
        }
        return { parent, name };
    }

    changeDir(path: string) {
        const resolved = this.resolvePath(path);
        const node = this.findNode(resolved);
        if (!node || node.type !== "directory") {
            return false;
        }
        this.cwd = resolved;
        return true;
    }

    listDir(path?: string) {
        const resolved = path ? this.resolvePath(path) : this.cwd;
        const node = this.findNode(resolved);
        if (!node || node.type !== "directory") {
            return null;
        }
        return node.children ?? [];
    }

    walk(
        path: string = this.cwd,
        cb?: (node: FileSystemNode, fullPath: string) => void,
    ) {
        const startNode = this.findNode(this.resolvePath(path));
        if (!startNode) {
            return [] as Array<{ node: FileSystemNode; path: string }>;
        }
        const results: Array<{ node: FileSystemNode; path: string }> = [];
        const visit = (node: FileSystemNode, currentPath: string) => {
            results.push({ node, path: currentPath });
            cb?.(node, currentPath);
            if (node.type === "directory") {
                (node.children ?? []).forEach((child) =>
                    visit(child, `${currentPath}/${child.name}`),
                );
            }
        };
        const basePath = normalizePath(path);
        visit(startNode, basePath === "/" ? "" : basePath);
        return results;
    }

    readFile(path: string) {
        const resolved = this.resolvePath(path);
        const node = this.findNode(resolved);
        if (!node || node.type !== "file") {
            return null;
        }
        return node.content ?? "";
    }

    writeFile(
        path: string,
        content: string,
        options: { append?: boolean; create?: boolean } = {},
    ) {
        const resolved = this.resolvePath(path);
        const existing = this.findNode(resolved);
        if (existing && existing.type === "file") {
            existing.content = options.append
                ? `${existing.content ?? ""}${content}`
                : content;
            return true;
        }
        if (!options.create) {
            return false;
        }
        const parentInfo = this.getParent(resolved);
        if (!parentInfo) {
            return false;
        }
        const { parent, name } = parentInfo;
        parent.children = parent.children ?? [];
        parent.children.push({
            name,
            type: "file",
            content,
        });
        return true;
    }

    createDir(path: string, recursive = false) {
        const resolved = this.resolvePath(path);
        const parts = splitPath(resolved);
        let node = this.root;
        for (let i = 0; i < parts.length; i += 1) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            const children = node.children ?? [];
            let next = children.find((child) => child.name === part);
            if (!next) {
                if (!recursive && !isLast) {
                    return false;
                }
                next = { name: part, type: "directory", children: [] };
                children.push(next);
                node.children = children;
            }
            if (next.type !== "directory") {
                return false;
            }
            node = next;
        }
        return true;
    }

    createFile(path: string) {
        return this.writeFile(path, "", { create: true });
    }

    remove(path: string, recursive = false) {
        const resolved = this.resolvePath(path);
        const parentInfo = this.getParent(resolved);
        if (!parentInfo) {
            return null;
        }
        const { parent, name } = parentInfo;
        const children = parent.children ?? [];
        const index = children.findIndex((child) => child.name === name);
        if (index === -1) {
            return null;
        }
        const target = children[index];
        if (target.type === "directory" && target.children?.length && !recursive) {
            return "not-empty";
        }
        children.splice(index, 1);
        parent.children = children;
        return target;
    }

    cloneNode(node: FileSystemNode): FileSystemNode {
        if (node.type === "file") {
            return { ...node, content: node.content ?? "" };
        }
        return {
            ...node,
            children: (node.children ?? []).map((child) => this.cloneNode(child)),
        };
    }

    copy(sourcePath: string, destPath: string) {
        const source = this.findNode(this.resolvePath(sourcePath));
        if (!source) {
            return false;
        }
        const destInfo = this.getParent(this.resolvePath(destPath));
        if (!destInfo) {
            return false;
        }
        const { parent, name } = destInfo;
        parent.children = parent.children ?? [];
        parent.children.push({ ...this.cloneNode(source), name });
        return true;
    }

    move(sourcePath: string, destPath: string) {
        const removed = this.remove(sourcePath, true);
        if (!removed || typeof removed === "string") {
            return false;
        }
        const destInfo = this.getParent(this.resolvePath(destPath));
        if (!destInfo) {
            return false;
        }
        const { parent, name } = destInfo;
        parent.children = parent.children ?? [];
        parent.children.push({ ...removed, name });
        return true;
    }
}
