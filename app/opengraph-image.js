import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#D9642B',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 160, lineHeight: 1, marginBottom: 10 }}>🍲</div>
        <div
          style={{
            fontSize: 90,
            fontWeight: 700,
            color: '#FFF8EE',
            letterSpacing: -2,
          }}
        >
          Hungry Buds
        </div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 500,
            color: '#FFE3C7',
            marginTop: 14,
            letterSpacing: 4,
            textTransform: 'uppercase',
          }}
        >
          Campus Delivery
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
