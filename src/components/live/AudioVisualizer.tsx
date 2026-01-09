
import { useEffect, useState } from "react"
import { cn } from "../../lib/utils"

type AudioVisualizerProps = {
    isActive: boolean
    mode: "listening" | "speaking" | "thinking" | "idle"
    framework: "agno" | "bee"
}

export function AudioVisualizer({ isActive, mode, framework }: AudioVisualizerProps) {
    // Generate random heights for bars to simulate audio
    const [bars, setBars] = useState<number[]>(Array(12).fill(10))

    useEffect(() => {
        if (!isActive || mode === 'idle') {
            setBars(Array(12).fill(10))
            return
        }

        const interval = setInterval(() => {
            setBars(prev => prev.map(() => {
                if (mode === 'listening') return 10 + Math.random() * 20; // Subtle movement
                if (mode === 'thinking') return 15 + Math.random() * 15; // Fast, nervous movement
                if (mode === 'speaking') return 10 + Math.random() * 50; // Large dynamic range
                return 10;
            }))
        }, 100)

        return () => clearInterval(interval)
    }, [isActive, mode])

    // Enterprise Dark colors: Amber for Agno (Speed), Indigo for Bee (Security)
    const colorClass = framework === 'agno' ? "bg-amber-500" : "bg-indigo-400"
    // Neon glow effect
    const glowClass = framework === 'agno' 
        ? "shadow-[0_0_12px_rgba(245,158,11,0.6)]" 
        : "shadow-[0_0_12px_rgba(129,140,248,0.6)]"

    return (
        <div className="flex items-center justify-center gap-1.5 h-16 w-full max-w-[200px] mx-auto transition-all duration-500">
            {bars.map((height, i) => (
                <div
                    key={i}
                    className={cn(
                        "w-1.5 rounded-full transition-all duration-100 ease-in-out", 
                        isActive && mode !== 'idle' ? colorClass : "bg-muted-foreground/20",
                        isActive && mode !== 'idle' && glowClass
                    )}
                    style={{ 
                        height: `${height}%`,
                        opacity: isActive ? 1 : 0.3
                    }}
                />
            ))}
        </div>
    )
}
