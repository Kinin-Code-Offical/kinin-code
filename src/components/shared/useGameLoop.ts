import { useEffect, useRef } from "react";

export function useGameLoop(callback: (dt: number) => void, active: boolean) {
    const rafRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);

    useEffect(() => {
        if (!active) {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            return;
        }

        lastTimeRef.current = performance.now();

        const loop = (time: number) => {
            const dt = time - lastTimeRef.current;
            lastTimeRef.current = time;
            callback(dt);
            rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);

        return () => cancelAnimationFrame(rafRef.current);
    }, [active, callback]);
}
