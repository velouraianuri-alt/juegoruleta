"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { WHEEL_ORDER, SEGMENT_DEG, colorForNumber } from "../wheel-data";

const POCKET_COLOR: Record<"red" | "black" | "green", string> = {
  red: "#b3122a",
  black: "#0d0f0b",
  green: "#0f4c2c",
};

const INNER_R = 1.55;
const OUTER_R = 2.25;
const POCKET_DEPTH = 0.09;
const SEPARATOR_HALF_DEG = 0.55;

/** A flat pie-slice wedge from `startDeg` to `endDeg`, between two radii. */
function wedgeShape(startDeg: number, endDeg: number, innerR: number, outerR: number) {
  const shape = new THREE.Shape();
  const a0 = (startDeg * Math.PI) / 180;
  const a1 = (endDeg * Math.PI) / 180;
  shape.moveTo(Math.cos(a0) * outerR, Math.sin(a0) * outerR);
  shape.absarc(0, 0, outerR, a0, a1, false);
  shape.lineTo(Math.cos(a1) * innerR, Math.sin(a1) * innerR);
  shape.absarc(0, 0, innerR, a1, a0, true);
  shape.closePath();
  return shape;
}

function PocketWedge({ index, number }: { index: number; number: number }) {
  const start = index * SEGMENT_DEG + SEPARATOR_HALF_DEG;
  const end = (index + 1) * SEGMENT_DEG - SEPARATOR_HALF_DEG;
  const color = colorForNumber(number);

  const geometry = useMemo(() => {
    const shape = wedgeShape(start, end, INNER_R, OUTER_R);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: POCKET_DEPTH,
      bevelEnabled: false,
      curveSegments: 6,
    });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, 0);
    return geo;
  }, [start, end]);

  const midDeg = (start + end) / 2;
  const midRad = (midDeg * Math.PI) / 180;
  const textRadius = (INNER_R + OUTER_R) / 2;

  return (
    <group>
      <mesh geometry={geometry} position={[0, -POCKET_DEPTH, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={POCKET_COLOR[color]} roughness={0.55} metalness={0.15} />
      </mesh>
      <Text
        position={[
          Math.cos(midRad) * textRadius,
          -POCKET_DEPTH + 0.005,
          Math.sin(midRad) * textRadius,
        ]}
        rotation={[-Math.PI / 2, 0, -midRad + Math.PI / 2]}
        fontSize={0.24}
        color={color === "black" ? "#f3e4b8" : "#faf1d8"}
        anchorX="center"
        anchorY="middle"
        maxWidth={1}
      >
        {number}
      </Text>
    </group>
  );
}

function Separator({ index }: { index: number }) {
  const boundaryDeg = index * SEGMENT_DEG;
  const geometry = useMemo(() => {
    const shape = wedgeShape(
      boundaryDeg - SEPARATOR_HALF_DEG,
      boundaryDeg + SEPARATOR_HALF_DEG,
      INNER_R - 0.03,
      OUTER_R + 0.03,
    );
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: POCKET_DEPTH + 0.07,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.01,
      bevelSegments: 2,
      curveSegments: 4,
    });
    geo.rotateX(Math.PI / 2);
    return geo;
  }, [boundaryDeg]);

  return (
    <mesh geometry={geometry} position={[0, -POCKET_DEPTH - 0.02, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#d4af37" roughness={0.25} metalness={0.9} />
    </mesh>
  );
}

/** The spinning part of the wheel: base disc, 37 pockets, separators, hub. Does NOT
 * include the stationary outer bowl/rim — that's rendered separately so it can stay
 * fixed while this group rotates. */
export function WheelRotor() {
  return (
    <group>
      {/* base disc under the pockets */}
      <mesh position={[0, -POCKET_DEPTH - 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[OUTER_R + 0.05, OUTER_R + 0.05, 0.1, 96]} />
        <meshStandardMaterial color="#0a1712" roughness={0.7} metalness={0.2} />
      </mesh>

      {WHEEL_ORDER.map((n, i) => (
        <PocketWedge key={n} index={i} number={n} />
      ))}
      {WHEEL_ORDER.map((_, i) => (
        <Separator key={i} index={i} />
      ))}

      {/* inner decorative track ring */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[INNER_R - 0.28, INNER_R - 0.05, 96]} />
        <meshStandardMaterial color="#c9a44c" roughness={0.3} metalness={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* center hub */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[INNER_R - 0.3, INNER_R - 0.34, 0.14, 48]} />
        <meshStandardMaterial color="#e9d192" roughness={0.2} metalness={0.95} />
      </mesh>
      <mesh position={[0, 0.13, 0]} castShadow>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial color="#f3e4b8" roughness={0.15} metalness={1} />
      </mesh>
    </group>
  );
}

/** Stationary outer bowl the ball orbits on before falling — doesn't rotate. */
export function WheelBowl() {
  return (
    <group>
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[OUTER_R + 0.08, OUTER_R + 0.75, 96]} />
        <meshStandardMaterial color="#0b1c13" roughness={0.6} metalness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* outer metallic rim */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[OUTER_R + 0.78, 0.06, 16, 96]} />
        <meshStandardMaterial color="#d4af37" roughness={0.2} metalness={0.95} />
      </mesh>
    </group>
  );
}
