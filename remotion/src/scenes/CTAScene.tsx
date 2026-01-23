import { useCurrentFrame, spring, useVideoConfig } from "remotion";
import { FadeIn } from "../components/FadeIn";

export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 100 },
  });

  const buttonScale = spring({
    frame: frame - 40,
    fps,
    config: { damping: 8, stiffness: 150 },
  });

  return (
    <div className="w-full h-full bg-white flex flex-col items-center justify-center relative overflow-hidden">
      <div className="relative z-10 text-center">
        {/* Logo */}
        <div className="mb-8" style={{ transform: `scale(${logoScale})` }}>
          <div className="inline-flex items-center justify-center w-20 h-20 bg-black mb-4">
            <svg
              viewBox="0 0 24 24"
              className="w-12 h-12 text-white"
              fill="currentColor"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <h1 className="text-5xl font-black text-black">grok-engage</h1>
        </div>

        <FadeIn delay={20} duration={30}>
          <p className="text-3xl text-black mb-10">
            Stop scrolling. Start shipping.
          </p>
        </FadeIn>

        {/* CTA */}
        <div style={{ transform: `scale(${Math.max(0, buttonScale)})` }}>
          <FadeIn delay={50} duration={30}>
            <div className="flex items-center gap-4 px-8 py-4 bg-black text-white font-black text-xl">
              ⭐ Star on GitHub ⭐
            </div>
          </FadeIn>

          <FadeIn delay={70} duration={30}>
            <p className="mt-4 text-neutral-500">
              github.com/yungookim/grok-engage
            </p>
          </FadeIn>
        </div>

        {/* Quick start */}
        <FadeIn delay={90} duration={30}>
          <div className="mt-10 p-4 bg-neutral-100 border-2 border-black inline-block">
            <code className="text-lg text-black">
              $ git clone && npm start
            </code>
          </div>
        </FadeIn>

        <FadeIn delay={110} duration={30}>
          <div className="mt-8 text-neutral-500">
            MIT · Node.js 18+ · Any LLM
          </div>
        </FadeIn>
      </div>
    </div>
  );
};
