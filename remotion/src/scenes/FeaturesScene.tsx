import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { FadeIn } from "../components/FadeIn";

const FeatureCard: React.FC<{
  title: string;
  description: string;
  icon: string;
  delay: number;
}> = ({ title, description, icon, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 180 },
  });

  const opacity = interpolate(frame - delay, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="p-6 bg-white border-2 border-black"
      style={{
        transform: `scale(${Math.max(0, scale)})`,
        opacity: Math.max(0, opacity),
      }}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-xl font-black text-black mb-2">{title}</h3>
      <p className="text-neutral-600 text-sm">{description}</p>
    </div>
  );
};

const ReplyStyleCard: React.FC<{
  style: string;
  example: string;
  delay: number;
}> = ({ style, example, delay }) => {
  const frame = useCurrentFrame();

  const slideX = interpolate(frame - delay, [0, 25], [50, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame - delay, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="p-4 bg-neutral-100 border border-black"
      style={{
        transform: `translateX(${slideX}px)`,
        opacity,
      }}
    >
      <div className="text-sm font-bold text-black mb-1">{style}</div>
      <p className="text-neutral-700 text-sm italic">"{example}"</p>
    </div>
  );
};

export const FeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Phase 1: Thread Discovery (0-120)
  // Phase 2: Reply Generation (120-240)
  // Phase 3: Learning System (240-360)

  const phase = frame < 120 ? 1 : frame < 240 ? 2 : 3;

  return (
    <div className="w-full h-full bg-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Phase 1: Thread Discovery */}
      {phase === 1 && (
        <div className="relative z-10 w-full max-w-5xl px-8">
          <FadeIn delay={0} duration={25}>
            <h2 className="text-5xl font-black text-center text-black mb-12">
              Find Threads Automatically
            </h2>
          </FadeIn>

          <div className="grid grid-cols-3 gap-6">
            <FeatureCard
              icon="🔍"
              title="Keyword Search"
              description="Real-time monitoring"
              delay={20}
            />
            <FeatureCard
              icon="🎯"
              title="Smart Filter"
              description="15+ replies only"
              delay={35}
            />
            <FeatureCard
              icon="📊"
              title="Relevance Score"
              description="0-100 ranking"
              delay={50}
            />
          </div>

          {/* Mock thread preview */}
          <FadeIn delay={70} duration={25}>
            <div className="mt-10 p-4 bg-white border-2 border-black max-w-md mx-auto">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-black" />
                <div>
                  <div className="text-black font-bold">@indiehacker</div>
                </div>
                <div className="ml-auto px-3 py-1 bg-black text-white text-sm font-bold">
                  87
                </div>
              </div>
              <p className="text-black">
                "What tools do you use to grow your SaaS?"
              </p>
              <div className="mt-2 text-neutral-500 text-sm">
                💬 47 · ❤️ 234
              </div>
            </div>
          </FadeIn>
        </div>
      )}

      {/* Phase 2: Reply Generation */}
      {phase === 2 && (
        <div className="relative z-10 w-full max-w-5xl px-8">
          <FadeIn delay={0} duration={25}>
            <h2 className="text-5xl font-black text-center text-black mb-12">
              AI-Generated Replies
            </h2>
          </FadeIn>

          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-4">
              <FadeIn delay={15} duration={25}>
                <div className="text-center mb-4">
                  <span className="text-3xl">💡</span>
                  <h3 className="text-xl font-black text-black mt-2">Value-Add</h3>
                </div>
              </FadeIn>
              <ReplyStyleCard
                style=""
                example="Great question! Focus on one channel first."
                delay={30}
              />
            </div>

            <div className="space-y-4">
              <FadeIn delay={25} duration={25}>
                <div className="text-center mb-4">
                  <span className="text-3xl">✨</span>
                  <h3 className="text-xl font-black text-black mt-2">Light Promo</h3>
                </div>
              </FadeIn>
              <ReplyStyleCard
                style=""
                example="This is why I built [Product]..."
                delay={45}
              />
            </div>

            <div className="space-y-4">
              <FadeIn delay={35} duration={25}>
                <div className="text-center mb-4">
                  <span className="text-3xl">🎯</span>
                  <h3 className="text-xl font-black text-black mt-2">Direct</h3>
                </div>
              </FadeIn>
              <ReplyStyleCard
                style=""
                example="Check out [Product] — saves hours."
                delay={60}
              />
            </div>
          </div>

          <FadeIn delay={80} duration={25}>
            <div className="mt-10 flex justify-center gap-4">
              <button className="px-4 py-2 bg-white border-2 border-black text-black text-sm font-bold">
                🔄 Funnier
              </button>
              <button className="px-4 py-2 bg-white border-2 border-black text-black text-sm font-bold">
                ✂️ Shorter
              </button>
              <button className="px-4 py-2 bg-white border-2 border-black text-black text-sm font-bold">
                🔧 Technical
              </button>
            </div>
          </FadeIn>
        </div>
      )}

      {/* Phase 3: Learning System */}
      {phase === 3 && (
        <div className="relative z-10 w-full max-w-5xl px-8">
          <FadeIn delay={0} duration={25}>
            <h2 className="text-5xl font-black text-center text-black mb-12">
              Gets Smarter Over Time
            </h2>
          </FadeIn>

          <div className="grid grid-cols-3 gap-8">
            <FeatureCard
              icon="🧠"
              title="Learns Preferences"
              description="Topics & authors"
              delay={20}
            />
            <FeatureCard
              icon="🎨"
              title="Matches Voice"
              description="Tone & style"
              delay={35}
            />
            <FeatureCard
              icon="📈"
              title="Tracks Results"
              description="What works"
              delay={50}
            />
          </div>

          <FadeIn delay={70} duration={25}>
            <div className="mt-10 p-6 bg-neutral-100 border-2 border-black text-center">
              <h4 className="text-2xl font-black text-black">
                Self-Improving Keywords
              </h4>
              <p className="text-neutral-600 mt-2">
                3-4x more relevant threads after a few weeks
              </p>
            </div>
          </FadeIn>
        </div>
      )}

      {/* Phase indicator */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-3">
        {[1, 2, 3].map((p) => (
          <div
            key={p}
            className={`w-3 h-3 transition-all ${
              phase === p ? "bg-black scale-125" : "bg-neutral-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
};
