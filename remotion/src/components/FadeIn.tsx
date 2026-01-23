import { useCurrentFrame, interpolate } from "remotion";

type FadeInProps = {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  className?: string;
};

export const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = 20,
  direction = "up",
  className = "",
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = frame - delay;

  const opacity = interpolate(adjustedFrame, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const offset = 40;
  let translateX = 0;
  let translateY = 0;

  if (direction === "up") {
    translateY = interpolate(adjustedFrame, [0, duration], [offset, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else if (direction === "down") {
    translateY = interpolate(adjustedFrame, [0, duration], [-offset, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else if (direction === "left") {
    translateX = interpolate(adjustedFrame, [0, duration], [offset, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else if (direction === "right") {
    translateX = interpolate(adjustedFrame, [0, duration], [-offset, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return (
    <div
      className={className}
      style={{
        opacity,
        transform: `translate(${translateX}px, ${translateY}px)`,
      }}
    >
      {children}
    </div>
  );
};
