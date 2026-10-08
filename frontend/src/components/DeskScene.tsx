import { useId } from "react";
import type { Lighting } from "../types";
export default function DeskScene({
  image,
  lighting,
  fit = "contain",
}: {
  image: string;
  lighting: Lighting;
  fit?: "contain" | "cover";
}) {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const fill = (name: string) => `url(#${id(name)})`;
  const tone = { warm: "#ffd29a", neutral: "#eef1f8", cool: "#8dc4ff" }[
    lighting.temperature
  ];
  const glow = lighting.brightness / 100;
  return (
    <svg
      className="desk-scene"
      viewBox="0 0 1400 780"
      role="img"
      aria-label="Your desk with a laptop, monitor, adjustable lamp, string lights, keyboard and flowers"
    >
      <defs>
        <linearGradient id={id("wall")} x2="0" y2="1">
          <stop stopColor="#30333b" />
          <stop offset="1" stopColor="#454954" />
        </linearGradient>
        <radialGradient id={id("ambient")}>
          <stop stopColor={tone} stopOpacity={0.2 * glow} />
          <stop offset="1" stopColor={tone} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("light")}>
          <stop stopColor={tone} stopOpacity={0.54 * glow} />
          <stop offset=".55" stopColor={tone} stopOpacity={0.17 * glow} />
          <stop offset="1" stopColor={tone} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("wood")} x2="0" y2="1">
          <stop stopColor="#755641" />
          <stop offset="1" stopColor="#3b2e27" />
        </linearGradient>
        <linearGradient id={id("metal")} x2="1" y2="1">
          <stop stopColor="#434849" />
          <stop offset=".5" stopColor="#222829" />
          <stop offset="1" stopColor="#111718" />
        </linearGradient>
        <linearGradient id={id("glass")}>
          <stop stopColor="#e5d6dd" stopOpacity=".22" />
          <stop offset=".4" stopColor="#d0a3c5" stopOpacity=".03" />
          <stop offset="1" stopColor="#edc7db" stopOpacity=".19" />
        </linearGradient>
        <linearGradient id={id("mat")} x2="0" y2="1">
          <stop stopColor="#2b2d2e" />
          <stop offset="1" stopColor="#1d2022" />
        </linearGradient>
        <linearGradient id={id("vase")}>
          <stop stopColor="#65818b" />
          <stop offset=".45" stopColor="#87969a" />
          <stop offset="1" stopColor="#465960" />
        </linearGradient>
        <linearGradient id={id("bezel")} x2="0" y2="1">
          <stop stopColor="#4e5452" />
          <stop offset=".04" stopColor="#1b2121" />
          <stop offset="1" stopColor="#111718" />
        </linearGradient>
        <pattern
          id={id("grain")}
          width="130"
          height="22"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 4q40-4 130 0M15 15q60-5 115-1"
            fill="none"
            stroke="#e1ac75"
            strokeOpacity=".07"
          />
        </pattern>
        <pattern
          id={id("keys")}
          width="27"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <rect
            x="2"
            y="2"
            width="22"
            height="19"
            rx="3"
            fill="#b8bbac"
            stroke="#202b24"
            strokeWidth="1.5"
          />
          <path d="M8 8h6" stroke="#edf0d2" strokeWidth="1" />
        </pattern>
        <pattern
          id={id("laptopkeys")}
          width="23"
          height="17"
          patternUnits="userSpaceOnUse"
        >
          <rect
            x="2"
            y="2"
            width="18"
            height="12"
            rx="1.5"
            fill="#25312b"
            stroke="#668962"
            strokeWidth=".7"
          />
        </pattern>
        <clipPath id={id("monitor")}>
          <rect x="528" y="263" width="457" height="258" rx="2" />
        </clipPath>
        <clipPath id={id("laptop")}>
          <rect x="224" y="343" width="280" height="180" rx="2" />
        </clipPath>
        <filter id={id("shadow")} x="-30%" y="-40%" width="160%" height="200%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" floodOpacity=".3" />
        </filter>
      </defs>
      <path fill={fill("wall")} d="M0 0h1400v780H0z" />
      <path
        d="M82 0v537M1260 0v519"
        stroke="#171f1b"
        opacity=".18"
        strokeWidth="3"
      />
      <ellipse cx="715" cy="360" rx="800" ry="550" fill={fill("ambient")} />
      {lighting.lamp && (
        <ellipse cx="627" cy="324" rx="500" ry="400" fill={fill("light")} />
      )}
      <path
        d="M-30 49Q670 378 1450 36"
        fill="none"
        stroke="#191f1c"
        strokeWidth="3"
      />
      <path
        d="M-30 47Q670 376 1450 34"
        fill="none"
        stroke="#7e8276"
        strokeWidth="1"
      />
      {[
        { x: 84, y: 96 },
        { x: 195, y: 138 },
        { x: 306, y: 174 },
        { x: 418, y: 202 },
        { x: 535, y: 221 },
        { x: 650, y: 232 },
        { x: 768, y: 233 },
        { x: 884, y: 222 },
        { x: 1000, y: 202 },
        { x: 1114, y: 173 },
        { x: 1225, y: 135 },
        { x: 1330, y: 90 },
      ].map((p, i) => (
        <g key={i}>
          <path d={`M${p.x} ${p.y - 10}v12`} stroke="#73786b" strokeWidth="3" />
          {lighting.garland && (
            <circle cx={p.x} cy={p.y + 9} r="25" fill={fill("light")} />
          )}
          <ellipse
            cx={p.x}
            cy={p.y + 9}
            rx="6"
            ry="8"
            fill={lighting.garland ? tone : "#82867a"}
            opacity={lighting.garland ? 0.35 + 0.65 * glow : 1}
          />
        </g>
      ))}
      <path d="M1141 171h55v372h-55z" fill="#191f1f" opacity=".68" />
      <path d="M1147 177h42v357h-42z" fill="#68716a" opacity=".25" />
      <path d="m1147 360 42-28v170h-42z" fill="#bec4ab" opacity=".13" />
      <path d="m190 555 994-14 216 172H0z" fill={fill("wood")} />
      <path d="m190 555 994-14 216 172H0z" fill={fill("grain")} />
      <path d="M0 713h1400v18H0z" fill="#34281f" />
      <path d="M0 714h1400" stroke="#8a6b4c" strokeWidth="3" />
      <path d="M113 731v49m1160-49v49" stroke="#141b1a" strokeWidth="24" />
      <path
        d="m484 581 646-14 178 132-959-2z"
        fill={fill("mat")}
        stroke="#48463e"
        strokeWidth="2"
      />
      <path
        d="m490 587 638-14 158 118-914-1z"
        fill="none"
        stroke="#666457"
        strokeOpacity=".18"
        strokeDasharray="2 4"
      />
      {/* Monitor arm and cables */}
      <path
        d="M966 472 1029 529v59"
        fill="none"
        stroke="#141c1b"
        strokeWidth="18"
        strokeLinejoin="round"
      />
      <path
        d="m966 472 63 57v39"
        fill="none"
        stroke="#3c4440"
        strokeWidth="3"
      />
      <ellipse cx="1029" cy="588" rx="28" ry="7" fill="#151c1a" />
      <path
        d="M747 509q-9 65 94 76M528 526q40 40 25 77M345 531q-75 16-99 57"
        fill="none"
        stroke="#171d1a"
        strokeWidth="4"
      />
      <g filter={fill("shadow")}>
        <rect
          x="517"
          y="251"
          width="480"
          height="290"
          rx="6"
          fill={fill("bezel")}
          stroke="#60665a"
          strokeWidth="1.4"
        />
        <rect x="528" y="263" width="457" height="258" fill="#0d1018" />
        <image
          className="monitor-wallpaper"
          href={image || undefined}
          x="528"
          y="263"
          width="457"
          height="258"
          preserveAspectRatio={
            fit === "contain" ? "xMidYMid meet" : "xMidYMid slice"
          }
          clipPath={fill("monitor")}
        />
        <path d="M529 521h456" stroke="#000" strokeWidth="2" />
        <text
          x="750"
          y="533"
          fill="#6a7165"
          fontSize="6"
          letterSpacing="2"
          textAnchor="middle"
        >
          STILL
        </text>
        <circle cx="980" cy="531" r="1.4" fill="#bde99e" />
      </g>
      {/* Level laptop screen and a symmetric base. */}
      <g filter={fill("shadow")} data-part="laptop">
        <rect
          x="212"
          y="331"
          width="304"
          height="212"
          rx="5"
          fill={fill("metal")}
          stroke="#707683"
          strokeWidth="1.5"
        />
        <rect x="224" y="343" width="280" height="180" fill="#0d1018" />
        <image
          className="laptop-wallpaper"
          href={image || undefined}
          x="224"
          y="343"
          width="280"
          height="180"
          preserveAspectRatio={
            fit === "contain" ? "xMidYMid meet" : "xMidYMid slice"
          }
          clipPath={fill("laptop")}
        />
        <path
          d="M212 543H516L550 611H178Z"
          fill="#20252e"
          stroke="#525a67"
          strokeWidth="1.4"
        />
        <path d="M226 552H502L524 587H204Z" fill={fill("laptopkeys")} />
        <path d="M326 590H402L410 604H318Z" fill="#343b46" stroke="#596574" />
        <path d="M178 611H550L547 617H181Z" fill="#121720" />
        <rect x="346" y="331" width="36" height="7" rx="3" fill="#b59b73" />
      </g>
      {/* Lamp, based on the reference's articulated arm */}
      <path
        d="m268 333 82-171 44-11"
        stroke="#141c1c"
        strokeWidth="12"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="m274 334 82-169" stroke="#63685f" strokeWidth="2" />
      <circle
        cx="352"
        cy="162"
        r="11"
        fill="#202723"
        stroke="#717466"
        strokeWidth="2"
      />
      <circle cx="352" cy="162" r="3" fill="#929281" />
      <path d="m361 153 262-22 2 17-263 21z" fill="#161e1e" stroke="#5c6358" />
      <path d="m371 171 284 34-2 14-285-38z" fill="#252c28" stroke="#727262" />
      <path
        d="m376 181 273 32"
        stroke={lighting.lamp ? tone : "#727262"}
        strokeWidth="3"
        opacity={lighting.lamp ? 0.4 + 0.6 * glow : 0.4}
      />
      <path
        d="M348 150q-53-34-52 0t46 5"
        fill="none"
        stroke="#161d1b"
        strokeWidth="3"
      />
      {/* Keyboard centered on the main monitor with level rows. */}
      <g filter={fill("shadow")} data-part="keyboard">
        <path
          d="M608 581H906L936 650H578Z"
          fill="#7d8795"
          stroke="#252c36"
          strokeWidth="2"
        />
        <path d="M612 583H902L927 642H587Z" fill="#b9c3cf" />
        {Array.from({ length: 4 }, (_, row) =>
          Array.from({ length: 14 }, (_, col) => {
            const keyWidth = 17.3 + row * 0.6;
            const x = 617 - row * 4.2 + col * (keyWidth + 2.6);
            const y = 587 + row * 11;
            return (
              <g key={`${row}-${col}`}>
                <rect
                  x={x}
                  y={y}
                  width={keyWidth}
                  height="8.5"
                  rx="1.8"
                  fill={row === 0 ? "#a6b6c9" : "#d3dce5"}
                  stroke="#647387"
                  strokeWidth=".7"
                />
                <path
                  d={`M${x + 5} ${y + 3.5}h4`}
                  stroke="#77879a"
                  strokeWidth=".7"
                />
              </g>
            );
          }),
        )}
        <rect
          x="696"
          y="632"
          width="112"
          height="8"
          rx="2"
          fill="#dce4eb"
          stroke="#8192a6"
        />
        <path
          d="M590 645H924"
          stroke={tone}
          strokeOpacity=".65"
          strokeWidth="2"
        />
      </g>
      {/* Controller */}
      <path
        d="M864 568q-21-23-40-4l-13 22q-1 12 12 9l20-14h26l17 12q16 5 12-11l-10-17q-11-9-24 3"
        fill="#171f1b"
        stroke="#485345"
        strokeWidth="2"
      />
      <path d="M832 567v15m-7-8h14" stroke="#8b9782" strokeWidth="3" />
      <circle cx="875" cy="571" r="3" fill="#a9b58a" />
      {/* Clock */}
      <path d="m903 540 105 1 4 50-110-2z" fill="#202823" stroke="#4e5849" />
      <text
        x="954"
        y="572"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="24"
        letterSpacing="2"
        fill="#d9e8cc"
      >
        10:32
      </text>
      <path d="M910 581h90" stroke="#313f31" />
      {/* Mouse */}
      <g transform="translate(1050 626) rotate(14)">
        <ellipse cx="2" cy="5" rx="34" ry="14" fill="#131917" opacity=".5" />
        <path
          d="M-24 9q-8-50 15-48Q18-41 29 8q-27 18-53 1"
          fill={fill("metal")}
          stroke="#465043"
        />
        <path d="M-6-34 0-9" stroke="#111813" strokeWidth="2" />
        <rect x="-9" y="-31" width="4" height="10" rx="2" fill="#7b8570" />
      </g>
      {/* Phone stand and notebook */}
      <path d="m1083 493 34-4 18 78-40 5z" fill="#18211e" stroke="#556052" />
      <path d="m1094 572 44-4 2 5-46 4z" fill="#1c2620" />
      <path d="m1027 595 55-4 18 15-60 5z" fill="#a4b19a" />
      <path d="m1033 598 42-3m-38 6 40-3" stroke="#687963" strokeWidth="1" />
      {/* Branches and red flowers */}
      <path
        d="m1184 549-14-123-32-46m38 84 30-33 8-38m-38 95-33-14-10-35m41 61 47-21 8-27m-61-26-26-18"
        fill="none"
        stroke="#372b2b"
        strokeWidth="4"
      />
      {[
        { x: 1141, y: 388 },
        { x: 1169, y: 433 },
        { x: 1208, y: 414 },
        { x: 1140, y: 459 },
        { x: 1197, y: 474 },
        { x: 1222, y: 465 },
        { x: 1177, y: 497 },
        { x: 1152, y: 421 },
      ].map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${i * 23})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse
              key={a}
              cy="-7"
              rx="5"
              ry="8"
              fill={i % 2 ? "#b75458" : "#984048"}
              transform={`rotate(${a})`}
            />
          ))}
          <circle r="3" fill="#dbb66c" />
        </g>
      ))}
      <path
        d="M1160 522q24-8 44 0l-4 37q-19 11-36 0z"
        fill={fill("vase")}
        stroke="#82908b"
      />
      <ellipse cx="1182" cy="522" rx="22" ry="5" fill="#33453f" />
      <path
        d="M1167 550q18 7 34-1"
        fill="none"
        stroke="#a29463"
        strokeWidth="4"
      />
      <ellipse cx="1182" cy="566" rx="24" ry="6" fill="#212b22" opacity=".5" />
      {/* Pink glass */}
      <ellipse cx="332" cy="674" rx="38" ry="9" fill="#181b19" opacity=".35" />
      <path
        d="M295 599q-7 68 20 78 19 9 35-4 22-19 16-74z"
        fill={fill("glass")}
        stroke="#ada9a2"
        strokeOpacity=".45"
      />
      <path
        d="M296 626q-1 42 21 48 21 8 34-9 14-13 15-39z"
        fill="#ae6089"
        opacity=".63"
      />
      <ellipse cx="331" cy="626" rx="35" ry="9" fill="#cb8eac" opacity=".5" />
      <ellipse
        cx="331"
        cy="599"
        rx="36"
        ry="9"
        fill="none"
        stroke="#b9b5aa"
        strokeOpacity=".6"
        strokeWidth="2"
      />
      <path
        d="M302 607q-2 35 10 49"
        fill="none"
        stroke="#fff"
        strokeOpacity=".18"
        strokeWidth="3"
      />
      {/* Notebook at the left */}
      <path d="m126 636 101 6-51 36-107-9z" fill="#95a491" />
      <path d="m135 628 98 11-54 33-100-12z" fill="#374d43" />
      <path d="m155 626 59 6-39 22-62-7z" fill="#151f1b" stroke="#5d6d5a" />
      <path d="M0 731h1400v49H0" fill="#111914" opacity=".58" />
    </svg>
  );
}
