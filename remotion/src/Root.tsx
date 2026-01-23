import "./index.css";
import { Composition } from "remotion";
import { DemoVideo, DEMO_VIDEO_DURATION } from "./DemoVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GrokEngageDemo"
        component={DemoVideo}
        durationInFrames={DEMO_VIDEO_DURATION}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
