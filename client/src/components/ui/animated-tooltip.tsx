import React, { useState } from "react";
import {
  motion,
  useTransform,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from "framer-motion";

export interface AnimatedTooltipItem {
  id: number | string;
  name: string;
  designation: string;
  image: string;
}

export const AnimatedTooltip = ({
  items,
}: {
  items: AnimatedTooltipItem[];
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | string | null>(null);
  const springConfig = { stiffness: 100, damping: 5 };
  const x = useMotionValue(0);

  const rotate = useSpring(
    useTransform(x, [-100, 100], [-45, 45]),
    springConfig
  );

  const translateX = useSpring(
    useTransform(x, [-100, 100], [-50, 50]),
    springConfig
  );

  const handleMouseMove = (event: any) => {
    const halfWidth = event.target.offsetWidth / 2;
    x.set(event.nativeEvent.offsetX - halfWidth);
  };

  return (
    <div className="flex flex-row items-center">
      {items.map((item) => (
        <div
          className="-mr-2 relative group"
          key={item.id}
          onMouseEnter={() => setHoveredIndex(item.id)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <AnimatePresence mode="popLayout">
            {hoveredIndex === item.id && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.7 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    type: "spring",
                    stiffness: 260,
                    damping: 10,
                  },
                }}
                exit={{ opacity: 0, y: 15, scale: 0.7 }}
                style={{
                  top: "-3.5rem",
                  left: "50%",
                  translateX: "-50%",
                  x: translateX,
                  rotate: rotate,
                  whiteSpace: "nowrap",
                }}
                className="absolute flex text-xs flex-col items-center justify-center rounded-lg bg-slate-950/95 backdrop-blur-md border border-white/20 z-50 shadow-2xl px-3 py-1.5 pointer-events-none"
              >
                <div className="absolute inset-x-6 z-30 w-[40%] -bottom-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent h-px" />
                <div className="font-bold text-white relative z-30 text-xs">
                  {item.name}
                </div>
                <div className="text-white/70 text-[10px] leading-tight max-w-[200px] truncate">
                  {item.designation}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="rounded-full overflow-hidden h-9 w-9 border-2 border-background/90 group-hover:scale-115 group-hover:z-30 group-hover:border-primary relative transition-all duration-300 bg-white shadow-sm flex items-center justify-center p-0.5 cursor-pointer">
            <img
              onMouseMove={handleMouseMove}
              src={item.image}
              alt={item.name}
              className="object-contain h-full w-full rounded-full"
            />
          </div>
        </div>
      ))}
    </div>
  );
};
