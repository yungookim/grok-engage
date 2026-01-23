import { useCurrentFrame, spring, useVideoConfig } from "remotion";
import { FadeIn } from "../components/FadeIn";

export const SolutionIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 100 },
  });

  return (
    <div className="w-full h-full bg-white flex flex-col items-center justify-center relative overflow-hidden">
      <div
        className="relative z-10 text-center"
        style={{ transform: `scale(${logoScale})` }}
      >
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-28 h-28 bg-black">
            <svg
              viewBox="0 0 24 24"
              className="w-16 h-16 text-white"
              fill="currentColor"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
        </div>

        <h1 className="text-7xl font-black text-black mb-6">
          grok-engage
        </h1>

        <FadeIn delay={30} duration={30}>
          <p className="text-3xl text-black mb-2">
            Find threads. Get AI replies.
          </p>
        </FadeIn>

        <FadeIn delay={60} duration={30}>
          <p className="text-3xl text-black">
            Post in one click.
          </p>
        </FadeIn>

        <FadeIn delay={90} duration={30}>
          <div className="mt-10 inline-flex items-center gap-3 px-6 py-3 border-2 border-black">
            <span className="text-black font-bold text-xl">
              Ship more. Scroll less.
            </span>
          </div>
        </FadeIn>
      </div>
    </div>
  );
};
