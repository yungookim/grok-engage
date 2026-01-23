import { useCurrentFrame, interpolate } from "remotion";
import { FadeIn } from "../components/FadeIn";

export const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();

  const bgOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scrollY = interpolate(frame, [30, 140], [0, -200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const frustratedOpacity = interpolate(frame, [100, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div className="w-full h-full bg-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Mock X Feed - scrolling */}
      <div
        className="absolute left-1/2 top-1/2 w-96 bg-white border-2 border-black overflow-hidden"
        style={{
          transform: `translate(-50%, -50%)`,
          opacity: bgOpacity,
          height: "400px",
        }}
      >
        <div className="p-4 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black" />
            <span className="text-black font-bold">For You</span>
          </div>
        </div>
        <div
          className="p-4 space-y-4"
          style={{ transform: `translateY(${scrollY}px)` }}
        >
          {[
            "Just had the best coffee",
            "My cat is so cute",
            "Hot take about pizza",
            "Anyone watching the game?",
            "Monday vibes",
            "New haircut!",
            "Politics post #47293",
            "Crypto to the moon",
          ].map((tweet, i) => (
            <div key={i} className="p-3 bg-neutral-100 border border-black">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-neutral-400" />
                <span className="text-neutral-600 text-sm">@user_{i}</span>
              </div>
              <p className="text-black text-sm">{tweet}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Frustrated text overlay */}
      <div
        className="absolute bottom-24 left-0 right-0 text-center"
        style={{ opacity: frustratedOpacity }}
      >
        <FadeIn delay={100} duration={30}>
          <p className="text-5xl font-black text-black mb-4">
            45 min scrolling...
          </p>
        </FadeIn>
        <FadeIn delay={120} duration={30}>
          <p className="text-2xl text-neutral-600">
            Zero relevant threads.
          </p>
        </FadeIn>
      </div>

      {/* Time indicator */}
      <div
        className="absolute top-8 right-8 text-black font-mono"
        style={{ opacity: bgOpacity }}
      >
        <FadeIn delay={20} duration={25}>
          <span className="text-2xl font-bold">
            ⏱️{" "}
            {Math.floor(
              interpolate(frame, [30, 140], [0, 45], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            )}{" "}
            min
          </span>
        </FadeIn>
      </div>
    </div>
  );
};
