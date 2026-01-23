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
        <div className="mb-12" style={{ transform: `scale(${logoScale})` }}>
          <div className="inline-flex items-center justify-center w-36 h-36 bg-black mb-6">
            <svg
              viewBox="0 0 24 24"
              className="w-24 h-24 text-white"
              fill="currentColor"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <h1 className="text-8xl font-black text-black">grok-engage</h1>
        </div>

        <FadeIn delay={20} duration={30}>
          <p className="text-5xl text-black mb-14">
            Stop scrolling. Start shipping.
          </p>
        </FadeIn>

        {/* CTA */}
        <div style={{ transform: `scale(${Math.max(0, buttonScale)})` }}>
          <FadeIn delay={50} duration={30}>
            <div className="flex items-center justify-center gap-6 px-12 py-6 bg-black text-white font-black text-4xl">
              ⭐ Star on GitHub ⭐
            </div>
          </FadeIn>

          <FadeIn delay={70} duration={30}>
            <p className="mt-6 text-neutral-500 text-2xl">
              github.com/yungookim/grok-engage
            </p>
          </FadeIn>
        </div>

        {/* Quick start */}
        <FadeIn delay={90} duration={30}>
          <div className="mt-14 p-6 bg-neutral-100 border-4 border-black inline-block">
            <code className="text-3xl text-black">
              $ git clone && npm start
            </code>
          </div>
        </FadeIn>

        <FadeIn delay={110} duration={30}>
          <div className="mt-10 text-neutral-500 text-2xl">
            MIT · Node.js 18+ · Any LLM
          </div>
        </FadeIn>
      </div>
    </div>
  );
};
