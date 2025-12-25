import QRCode from 'qrcode';

export class QRCodeGenerator {
  /**
   * Generate a QR code data URL for a join URL
   */
  async generateQRCode(joinUrl: string): Promise<string> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(joinUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      return qrCodeDataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate a join URL for a session
   */
  generateJoinUrl(baseUrl: string, sessionId: string): string {
    return `${baseUrl}/join?session=${sessionId}`;
  }
}

export const qrCodeGenerator = new QRCodeGenerator();
