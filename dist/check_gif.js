"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function main() {
    const urls = [
        'https://images2.productserve.com/?w=70&h=70&bg=white&trim=5&t=letterbox&url=ssl%3Acdn.shopify.com%2Fs%2Ffiles%2F1%2F0860%2F7760%2F4174%2Ffiles%2F10_7fc55baf-2216-4dbe-8512-c0d0470a4ff9.jpg%3Fv%3D1732657354&feedId=99953&k=bc2482986d23162b78166179217a32ec16a5c5a7',
        'https://images2.productserve.com/?w=200&h=200&bg=white&trim=5&t=letterbox&url=ssl%3Acdn.shopify.com%2Fs%2Ffiles%2F1%2F0860%2F7760%2F4174%2Ffiles%2F10_7fc55baf-2216-4dbe-8512-c0d0470a4ff9.jpg%3Fv%3D1732657354&feedId=99953&k=bc2482986d23162b78166179217a32ec16a5c5a7',
        'https://images2.productserve.com/preview/107998/40353049440.jpg?w=900&h=900&bg=white&t=letterbox&url=https%3A%2F%2Fcdn.shopify.com%2Fs%2Ffiles%2F1%2F0860%2F7760%2F4174%2Ffiles%2F10_7fc55baf-2216-4dbe-8512-c0d0470a4ff9.jpg%3Fv%3D1732657354'
    ];
    for (const u of urls) {
        try {
            const res = await fetch(u);
            const buf = await res.arrayBuffer();
            console.log(`URL: ${u}`);
            console.log(`Length: ${buf.byteLength}, Type: ${res.headers.get('content-type')}`);
        }
        catch (e) {
            console.log(`URL: ${u} - Error: ${e.message}`);
        }
    }
}
main().catch(console.error);
//# sourceMappingURL=check_gif.js.map