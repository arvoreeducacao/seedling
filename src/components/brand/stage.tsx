import type { CSSProperties, ReactNode } from "react";
import { Actor } from "./actor";
import { Starfield, type StarfieldProps } from "./starfield";

export type StageProps = {
  starfield?: boolean | StarfieldProps;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

function StageRoot({ starfield = false, className, style, children }: StageProps) {
  const sky = starfield === true ? {} : starfield || null;
  return (
    <div className={className} style={{ position: "relative", isolation: "isolate", ...style }}>
      {sky && <Starfield {...sky} style={{ zIndex: -2, ...sky.style }} />}
      {children}
    </div>
  );
}

export const Stage = Object.assign(StageRoot, { Actor });
