import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

export const ScrollIndicator = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      // Hide if scrolled down more than 100px
      if (window.scrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 md:hidden z-50 flex flex-col items-center animate-bounce pointer-events-none"
      style={{
        textShadow: "0 2px 4px rgba(0,0,0,0.5)",
      }}
    >
      <span className="text-xs font-bold text-white bg-black/50 px-3 py-1 rounded-full mb-1 backdrop-blur-sm">
        Scroll for Stats & Community
      </span>
      <ChevronDown className="w-6 h-6 text-white drop-shadow-md" />
    </div>
  );
};
