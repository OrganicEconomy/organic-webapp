import { Page } from '@playwright/test';
import QRCode from 'qrcode';

const FRAME_SIZE = 480;
const FRAMES_PER_SECOND = 10;

export async function pointCameraAtContactCard(
  page: Page,
  card: { pk: string; url: string; n: string },
): Promise<void> {
  const { encodeContactQr } = await import('organic-protocol');
  await pointCameraAtQr(page, encodeContactQr(card));
}

async function pointCameraAtQr(page: Page, qrText: string): Promise<void> {
  const qrImage = await QRCode.toDataURL(qrText, { width: FRAME_SIZE, margin: 4 });

  await page.addInitScript(
    ({ qrImage, frameSize, framesPerSecond }) => {
      navigator.mediaDevices.getUserMedia = async () => {
        const image = new Image();
        image.src = qrImage;
        await image.decode();

        const canvas = document.createElement('canvas');
        canvas.width = frameSize;
        canvas.height = frameSize;
        const context = canvas.getContext('2d')!;
        const drawFrame = () => context.drawImage(image, 0, 0, frameSize, frameSize);
        drawFrame();
        setInterval(drawFrame, 1000 / framesPerSecond);

        return canvas.captureStream(framesPerSecond);
      };
    },
    { qrImage, frameSize: FRAME_SIZE, framesPerSecond: FRAMES_PER_SECOND },
  );
}
