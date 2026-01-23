import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

type AnimatedTextProps = {
  text: string;
  delay?: number;
  className?: string;
  type?: "fade" | "slide" | "spring" | "typewriter";
};

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  delay = 0,
  className = "",
  type = "spring",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = frame - delay;

  if (type === "typewriter") {
    const progress = interpolate(adjustedFrame, [0, text.length * 2], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const chars = Math.floor(progress * text.length);
    return (
      <span className={className}>
        {text.slice(0, chars)}
        {chars < text.length && (
          <span className="animate-pulse">|</span>
        )}
      </span>
    );
  }

  if (type === "fade") {
    const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <span className={className} style={{ opacity }}>
        {text}
      </span>
    );
  }

  if (type === "slide") {
    const opacity = interpolate(adjustedFrame, [0, 10], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const translateY = interpolate(adjustedFrame, [0, 15], [30, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <span
        className={className}
        style={{ opacity, transform: `translateY(${translateY}px)` }}
      >
        {text}
      </span>
    );
  }

  // spring animation (default)
  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });
  const opacity = interpolate(adjustedFrame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <span
      className={className}
      style={{ opacity, transform: `scale(${scale})` }}
    >
      {text}
    </span>
  );
};
