import { 
    ChevronRight, 
    ChevronLeft, 
    Play, 
    Pause, 
    Volume2, 
    VolumeX,
    Star,
    ArrowRight
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";

// Assets
// @ts-ignore
import heroVideo from "@/assets/hero-video.mp4";
// @ts-ignore
import sizzlingVideo from "@/assets/Sizzling_Indian_Food_Video_Generated.mp4";
// @ts-ignore
import heroFood from "@/assets/hero-food.jpg";

interface HeroBannerProps {
    onOrderNow?: () => void;
}

const SLIDE_DURATION = 5000;

// Dynamically import all images from the harvest-images assets folder
const imageModules = import.meta.glob("../assets/harvest-images/*.{png,jpg,jpeg,SVG,webp,JPG}", {
    eager: true,
    import: 'default'
});

const harvestImages = Object.values(imageModules) as string[];

const mediaItems = [
    { 
        type: 'video', 
        src: heroVideo, 
        tag: "Open for Dining",
        tagColor: "#4AEAAA",
        title: "Harvest", 
        titleAccent: "& Ember", 
        sub: "Fine Dining · Grill · International Cuisine",
        cta: "Explore Menu",
        deco: "🕯️",
        accent: "#E23744"
    },
    { 
        type: 'video', 
        src: sizzlingVideo, 
        tag: "Chef's Specials",
        tagColor: "#FFD580",
        title: "Tonight's", 
        titleAccent: "Finest", 
        sub: "Handpicked premium dishes by our Head Chef",
        cta: "See Chef's Picks",
        deco: "👨‍🍳",
        accent: "#F59E0B"
    },
    { 
        type: 'image', 
        src: heroFood, 
        tag: "Exclusive Deal",
        tagColor: "#93C5FD",
        title: "Flat 30%", 
        titleAccent: "Off Combos", 
        sub: "Use code COMBO30 · Valid on all combo meals today",
        cta: "Grab the Deal",
        deco: "🎁",
        accent: "#3B82F6"
    },
    ...harvestImages.map((img) => ({ 
        type: 'image', 
        src: img, 
        tag: "Harvest Highlights",
        tagColor: "#4AEAAA",
        title: "Fresh", 
        titleAccent: "Valley Picks", 
        sub: "Experience organic feasts from our local farms",
        cta: "Explore Menu",
        accent: "#E23744"
    }))
];

export default function HeroBanner({ onOrderNow }: HeroBannerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [muted, setMuted] = useState(true);
    const [pKey, setPKey] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout>>();

    const goTo = useCallback((i: number) => {
        setCurrentIndex(i);
        setPKey(k => k + 1);
    }, []);

    const handleNext = useCallback(() => {
        goTo((currentIndex + 1) % mediaItems.length);
    }, [currentIndex, goTo]);

    const handlePrev = useCallback(() => {
        goTo((currentIndex - 1 + mediaItems.length) % mediaItems.length);
    }, [currentIndex, goTo]);

    useEffect(() => {
        if (paused) return;
        timerRef.current = setTimeout(handleNext, SLIDE_DURATION);
        return () => clearTimeout(timerRef.current);
    }, [currentIndex, paused, handleNext]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = muted;
        }
    }, [muted]);

    const currentMedia = mediaItems[currentIndex];

    return (
        <div className="group/banner relative mb-5 h-[42vh] min-h-[320px] w-full overflow-hidden shadow-2xl font-['DM_Sans',sans-serif] sm:mb-6 sm:h-[50vh] sm:max-h-[450px]">
            <style>{`
                @keyframes progressAnim {
                    from { width: 0%; }
                    to { width: 100%; }
                }
                .hero-progress-bar {
                    height: 3px;
                    background: rgba(255, 255, 255, 0.4);
                    position: absolute;
                    top: 0;
                    left: 0;
                    z-index: 40;
                    width: 0%;
                    animation: progressAnim ${SLIDE_DURATION}ms linear forwards;
                }
                .hero-progress-bar-paused {
                    animation-play-state: paused;
                }
                .glass-btn {
                    background: rgba(255, 255, 255, 0.25);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .glass-btn:hover {
                    background: rgba(255, 255, 255, 0.35);
                    transform: scale(1.05);
                }
                .glass-btn:active {
                    transform: scale(0.95);
                }
                @keyframes floatEl {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
            `}</style>

            {/* Progress Bar */}
            <div 
                key={`${currentIndex}-${pKey}`} 
                className={`hero-progress-bar ${paused ? 'hero-progress-bar-paused' : ''}`} 
            />

            {/* Media Layer */}
            <div className="absolute inset-0 bg-[#000]">
                {currentMedia.type === 'video' ? (
                    <video
                        ref={videoRef}
                        key={currentMedia.src}
                        src={currentMedia.src}
                        autoPlay
                        muted={muted}
                        loop
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover opacity-100"
                    />
                ) : (
                    <img
                        key={currentMedia.src}
                        src={currentMedia.src}
                        alt={currentMedia.title}
                        className="absolute inset-0 w-full h-full object-cover opacity-100"
                    />
                )}
            </div>

            {/* Premium Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

            {/* Decoration Icon — exact Sana sizing */}
            {currentMedia.deco && (
                <div 
                    className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none sm:right-5 sm:block"
                    style={{ fontSize: 54, opacity: 0.5, animation: "floatEl 3.5s ease-in-out infinite" }}
                >
                    {currentMedia.deco}
                </div>
            )}

            {/* Navigation Arrows - ALWAYS VISIBLE */}
            <button
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="glass-btn absolute left-2 top-[36%] z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white sm:left-4 sm:top-[38%] sm:flex"
                aria-label="Previous slide"
            >
                <ChevronLeft className="w-6 h-6" />
            </button>

            <button
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="glass-btn absolute right-2 top-[36%] z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white sm:right-4 sm:top-[38%] sm:flex"
                aria-label="Next slide"
            >
                <ChevronRight className="w-6 h-6" />
            </button>

            {/* Bottom Content Area */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-end px-4 pb-5 sm:px-6 sm:pb-8">
                <div className="flex items-center gap-2 mb-2.5">
                    <div className="glass-btn flex items-center gap-1.5 px-2.5 py-1 rounded-full pointer-events-auto">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1BA672] animate-pulse" style={{ display: "block" }} />
                        <span className="text-[11px] font-bold" style={{ color: currentMedia.tagColor || '#fff' }}>{currentMedia.tag}</span>
                    </div>
                    {currentIndex === 0 && (
                        <div className="glass-btn flex items-center gap-1 px-2 py-1 rounded-full pointer-events-auto">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-[11px] font-bold text-white">4.8</span>
                        </div>
                    )}
                </div>

                <h1 className="max-w-[85%] text-[28px] font-black leading-[1.05] text-white sm:max-w-none sm:text-[34px]">
                    {currentMedia.title}{" "}
                    <em style={{ color: currentMedia.accent, fontStyle: "italic" }}>{currentMedia.titleAccent}</em>
                </h1>

                <p className="mt-1 max-w-[90%] text-[11px] font-medium sm:max-w-[70%] sm:text-[12px]" style={{ color: "rgba(255,255,255,.68)" }}>
                    {currentMedia.sub}
                </p>

                <div className="pointer-events-auto mt-4">
                    <button
                        onClick={onOrderNow}
                        className="glass-btn flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-[13px] text-white transition-all hover:scale-105 active:scale-95"
                        style={{ background: currentMedia.accent, border: 'none', boxShadow: `0 4px 18px ${currentMedia.accent}55` }}
                    >
                        {currentMedia.cta} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Bottom-Right Controls Bar (Exact Sana Style) */}
            <div className="pointer-events-auto absolute bottom-4 left-4 right-4 z-50 flex items-center justify-between gap-3 sm:bottom-6 sm:left-auto sm:right-6 sm:w-auto sm:justify-end">
                <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-white/40 bg-white/20 px-3 py-2 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] sm:px-4 sm:py-2.5">
                    <div className="mr-2 flex gap-1.5 sm:mr-4">
                        {mediaItems.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => goTo(idx)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                    idx === currentIndex ? "w-6 bg-white sm:w-8" : "w-1.5 bg-white/40 hover:bg-white/60"
                                }`}
                            />
                        ))}
                    </div>
                    
                    <div className="flex items-center gap-2 border-l border-white/20 pl-3 sm:gap-3 sm:pl-4">
                        <button
                            onClick={() => setPaused(!paused)}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                        >
                            {paused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4 fill-white" />}
                        </button>

                        {(currentMedia.type === 'video' || videoRef.current) && (
                            <button
                                onClick={() => setMuted(!muted)}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                            >
                                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}




