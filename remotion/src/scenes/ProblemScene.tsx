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
        className="absolute left-1/2 top-1/2 bg-white border-4 border-black overflow-hidden"
        style={{
          transform: `translate(-50%, -50%)`,
          opacity: bgOpacity,
          width: "700px",
          height: "650px",
        }}
      >
        <div className="p-6 border-b-4 border-black">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-black" />
            <span className="text-black font-bold text-3xl">For You</span>
          </div>
        </div>
        <div
          className="p-6 space-y-5"
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
            <div key={i} className="p-5 bg-neutral-100 border-2 border-black">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-neutral-400" />
                <span className="text-neutral-600 text-2xl">@user_{i}</span>
              </div>
              <p className="text-black text-2xl">{tweet}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Frustrated text overlay */}
      <div
        className="absolute bottom-32 left-0 right-0 text-center"
        style={{ opacity: frustratedOpacity }}
      >
        <FadeIn delay={100} duration={30}>
          <p className="text-7xl font-black text-black mb-6">
            45 min scrolling...
          </p>
        </FadeIn>
        <FadeIn delay={120} duration={30}>
          <p className="text-4xl text-neutral-600">
            Zero relevant threads.
          </p>
        </FadeIn>
      </div>

      {/* Time indicator */}
      <div
        className="absolute top-12 right-12 text-black font-mono"
        style={{ opacity: bgOpacity }}
      >
        <FadeIn delay={20} duration={25}>
          <span className="text-5xl font-bold">
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
