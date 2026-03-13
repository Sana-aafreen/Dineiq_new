import { ChevronRight, ChevronLeft } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
// @ts-ignore
import heroVideo from "@/assets/hero-video.mp4";

interface HeroBannerProps {
    onOrderNow?: () => void;
}

// Dynamically import all images from the harvest-images assets folder
const imageModules = import.meta.glob("../assets/harvest-images/*.{png,jpg,jpeg,SVG,webp,JPG}", {
    eager: true,
    import: 'default'
});

const harvestImages = Object.values(imageModules) as string[];

const mediaItems = [
    { type: 'video', src: heroVideo },
    ...harvestImages.map(img => ({ type: 'image', src: img }))
];


export default function HeroBanner({ onOrderNow }: HeroBannerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    const handleNext = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % mediaItems.length);
    }, []);

    const handlePrev = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            handleNext();
        }, 5000); // Rotate every 5 seconds

        return () => clearInterval(timer);
    }, [handleNext]);

    const currentMedia = mediaItems[currentIndex];

    return (
        <div className="relative w-full h-[50vh] max-h-[450px] overflow-hidden shadow-lg mb-6 group/banner">
            {currentMedia.type === 'video' ? (
                <video
                    key="hero-video"
                    src={currentMedia.src}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover animate-fade-in"
                />
            ) : (
                <img
                    key={currentMedia.src}
                    src={currentMedia.src}
                    alt="Harvest"
                    className="absolute inset-0 w-full h-full object-cover animate-fade-in"
                />
            )}

            {/* Dark Overlay/Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Manual Navigation Arrows */}
            <button
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white opacity-0 group-hover/banner:opacity-100 transition-opacity hover:bg-black/40 active:scale-90"
                aria-label="Previous slide"
            >
                <ChevronLeft className="w-6 h-6" />
            </button>

            <button
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white opacity-0 group-hover/banner:opacity-100 transition-opacity hover:bg-black/40 active:scale-90"
                aria-label="Next slide"
            >
                <ChevronRight className="w-6 h-6" />
            </button>

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white text-center flex flex-col items-center animate-slide-up">
                <span className="inline-block px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full mb-3 uppercase tracking-wider">
                    Harvest Highlights
                </span>
                <h1 className="text-4xl md:text-5xl font-black mb-2 leading-tight">
                    Harvest <span className="text-yellow-400">DineIQ</span>
                </h1>
                <p className="text-white/90 text-sm md:text-base font-medium mb-6 max-w-xs mx-auto">
                    Experience the bounty of the valley with our AI-curated organic feasts.
                </p>

                <button
                    onClick={onOrderNow}
                    className="group flex items-center gap-2 bg-white text-red-600 px-8 py-3 rounded-full font-bold text-lg shadow-xl hover:bg-gray-100 transition-all active:scale-95"
                >
                    Check Menu
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>

            {/* Pagination Indicators */}
            <div className="absolute top-4 right-4 flex gap-1.5 z-20">
                {mediaItems.map((_, idx) => (
                    <div
                        key={idx}
                        className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}
