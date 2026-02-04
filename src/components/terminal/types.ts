export type TerminalRenderTheme = {
    bg: string;
    text: string;
    dim: string;
    accent: string;
};

export interface Program {
    onInput(key: string): void;
    tick(dt: number): void;
    render(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        theme: TerminalRenderTheme,
    ): void;
}

export type TerminalFile = {
    path: string;
    content?: string;
    section?: string;
    type?: "file" | "dir";
};

export type TerminalMessages = {
    welcome: string;
    hint: string;
    help: readonly string[];
    availableFiles: string;
    tip: string;
    commandNotFound: string;
    fileNotFound: string;
    noSuchDirectory: string;
    mkdirMissing?: string;
    touchMissing?: string;
    hello?: string;
    system?: {
        exit: string;
        exitLine: string;
        historyCleared: string;
        noOutput: string;
        moreResults: string;
        userFallback: string;
        unameShort: string;
        unameLong: string;
        uptime: string;
    };
    commands?: {
        aliasDefinition: string;
        echoMissingFile: string;
        mkdirCannotCreate: string;
        rmMissingOperand: string;
        rmIsDirectory: string;
        rmdirMissingOperand: string;
        rmdirNotEmpty: string;
        cpMissingOperand: string;
        cpIsDirectory: string;
        mvMissingOperand: string;
        catMissingOperand: string;
        headMissingOperand: string;
        grepMissing: string;
        whichMissing: string;
        whichBuiltin: string;
        whichNotFound: string;
        manMissingTopic: string;
        manNoEntry: string;
    };
    manuals?: Record<string, readonly string[]>;
    python?: {
        version: string;
        usage: string;
        missingCode: string;
        loading: string;
        error: string;
        cantOpen: string;
    };
    pip?: {
        help: string;
        missingPackage: string;
        installed: string;
        uninstalled: string;
        packageNotFound: string;
        unknownCommand: string;
    };
    calc?: {
        launch: string;
        invalidChars: string;
        evalError: string;
        invalid: string;
        error: string;
        hintLine1: string;
        hintLine2: string;
    };
    media?: {
        mp3NoMedia: string;
        videoNoMedia: string;
        imageNoMedia: string;
        imageUnsupported: string;
        imageLoading: string;
        imageLoadError: string;
        playbackComplete: string;
        playing: string;
        paused: string;
        loadingImage: string;
        unableToLoadImage: string;
        noImagesFound: string;
    };
};

export type TerminalConfig = {
    prompt: string;
    introLines: readonly string[];
    homePath: string;
    files: TerminalFile[];
    messages: TerminalMessages;
    onNavigateAction?: (section: string) => void;
};
