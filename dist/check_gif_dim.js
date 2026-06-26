"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function main() {
    const url = 'https://images2.productserve.com/?w=70&h=70&bg=white&trim=5&t=letterbox&url=ssl%3Acdn.shopify.com%2Fs%2Ffiles%2F1%2F0860%2F7760%2F4174%2Ffiles%2F10_7fc55baf-2216-4dbe-8512-c0d0470a4ff9.jpg%3Fv%3D1732657354&feedId=99953&k=bc2482986d23162b78166179217a32ec16a5c5a7';
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const view = new DataView(buf);
    const width = view.getUint16(6, true);
    const height = view.getUint16(8, true);
    console.log(`GIF Dimensions: ${width}x${height}`);
}
main().catch(console.error);
//# sourceMappingURL=check_gif_dim.js.map