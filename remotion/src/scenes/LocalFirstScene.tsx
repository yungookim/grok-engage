import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { FadeIn } from "../components/FadeIn";

const BenefitRow: React.FC<{
  icon: string;
  title: string;
  delay: number;
}> = ({ icon, title, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  const opacity = interpolate(frame - delay, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="flex items-center gap-4 p-4 bg-white border-2 border-black"
      style={{
        transform: `scale(${Math.max(0, scale)})`,
        opacity: Math.max(0, opacity),
      }}
    >
      <div className="text-3xl">{icon}</div>
      <h4 className="text-black font-bold text-lg">{title}</h4>
    </div>
  );
};

const LLMBadge: React.FC<{
  name: string;
  delay: number;
}> = ({ name, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bounce = spring({
    frame: frame - delay,
    fps,
    config: { damping: 8, stiffness: 150 },
  });

  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="px-4 py-2 bg-black text-white font-bold text-sm"
      style={{
        transform: `scale(${Math.max(0, bounce)})`,
        opacity: Math.max(0, opacity),
      }}
    >
      {name}
    </div>
  );
};

export const LocalFirstScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const checkmarkScale = spring({
    frame: frame - 120,
    fps,
    config: { damping: 8, stiffness: 200 },
  });

  return (
    <div className="w-full h-full bg-white flex flex-col items-center justify-center relative overflow-hidden">
      <div className="relative z-10 w-full max-w-5xl px-8">
        <FadeIn delay={0} duration={30}>
          <div className="text-center mb-10">
            <h2 className="text-5xl font-black text-black mb-4">
              100% Local-First
            </h2>
            <p className="text-2xl text-neutral-600">
              Your machine. Your data. Your rules.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-2 gap-8">
          {/* Left column: Benefits */}
          <div className="space-y-4">
            <BenefitRow icon="🔐" title="Encrypted credentials" delay={30} />
            <BenefitRow icon="🚫" title="No cloud required" delay={45} />
            <BenefitRow icon="📦" title="SQLite database" delay={60} />
            <BenefitRow icon="👁️" title="Zero tracking" delay={75} />
          </div>

          {/* Right column: LLM Flexibility */}
          <div>
            <FadeIn delay={90} duration={30}>
              <div className="p-6 bg-neutral-100 border-2 border-black h-full">
                <h3 className="text-2xl font-black text-black mb-4">
                  🤖 Use Any LLM
                </h3>
                <p className="text-neutral-600 mb-6">
                  Swap in any model you want:
                </p>

                <div className="flex flex-wrap gap-3">
                  <LLMBadge name="Grok" delay={110} />
                  <LLMBadge name="GPT-4" delay={120} />
                  <LLMBadge name="Claude" delay={130} />
                  <LLMBadge name="Llama" delay={140} />
                  <LLMBadge name="Ollama" delay={150} />
                </div>
              </div>
            </FadeIn>
          </div>
        </div>

        {/* Bottom emphasis */}
        <FadeIn delay={160} duration={30}>
          <div className="mt-10 text-center">
            <div
              className="inline-flex items-center gap-3 px-6 py-3 border-2 border-black"
              style={{
                transform: `scale(${Math.max(0, checkmarkScale)})`,
              }}
            >
              <span className="text-black text-2xl">✓</span>
              <span className="text-black font-bold text-xl">
                Just JavaScript — inspect & modify anytime
              </span>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
};
