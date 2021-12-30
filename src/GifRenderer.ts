// TODO: uninstall gif libraries

import {GifReader} from "omggif";
// @ts-ignore
import GIF from "gif.js.optimized";

export async function loadGifFrames(gifUrl: string): Promise<[HTMLCanvasElement, number][]> {
	const response = await fetch(gifUrl);
	const blob = await response.blob();
	const arrayBuffer = await blob.arrayBuffer();
	const intArray = new Uint8Array(arrayBuffer);

	const reader = new GifReader(intArray as Buffer);

	// return new Array(reader.numFrames()).fill(0).map((_, k) => {
	// 	const info = reader.frameInfo(k);

	// 	const image = new ImageData(info.width, info.height);

	// 	reader.decodeAndBlitFrameRGBA(k, image.data as any);

	// 	return [image, info.delay];
	// });

	const info = reader.frameInfo(0);

	return new Array(reader.numFrames()).fill(0).map((_, k) => {
		const image = new ImageData(info.width, info.height);

		reader.decodeAndBlitFrameRGBA(k, image.data as any);

		let canvas = document.createElement("canvas");

		canvas.width = info.width;
		canvas.height = info.height;

		canvas.getContext("2d")!.putImageData(image, 0, 0);

		return [canvas, reader.frameInfo(k).delay];
	});
}

export async function renderImage(mainImage: string, captionImage: string): Promise<string | null> {
	const gif = new Image();
	const caption = new Image();
	const promise = Promise.all([
		new Promise((a) => {
			gif.onload = a;
		}),
		new Promise((a) => {
			caption.onload = a;
		}),
	]);
	gif.src = mainImage;
	caption.src = captionImage;
	await promise;

	const captionAr = caption.width / caption.height;
	const newCaptionHeight = gif.width * (1 / captionAr) + 1; // grey line hack

	const canvas = document.createElement("canvas");
	canvas.width = gif.width;
	canvas.height = gif.height + newCaptionHeight;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw Error("No 2d context");
	}

	let blob = null;
	if (mainImage.startsWith("data:image/gif")) {
		blob = await renderGif(caption, gif, canvas, newCaptionHeight, ctx);
	} else {
		blob = await renderStaticImage(caption, gif, canvas, newCaptionHeight, ctx);
	}

	const response = await fetch("https://jiftoo.dev/gif/backend", {
		method: "POST",
		mode: "cors",
		body: blob,
	});

	if (response.ok) {
		return await response.text();
	} else {
		return null;
	}
}

async function renderGif(caption: HTMLImageElement, gif: HTMLImageElement, canvas: HTMLCanvasElement, newCaptionHeight: number, ctx: CanvasRenderingContext2D): Promise<Blob> {
	const frames = await loadGifFrames(gif.src);

	const gifBuilder = new GIF({workers: 2, quality: 10, width: canvas.width, height: canvas.height});

	frames.forEach(([image, delay]) => {
		ctx.drawImage(caption, 0, 0, canvas.width, Math.round(newCaptionHeight));
		// ctx.putImageData(image, 0, newCaptionHeight - 1); // grey line hack
		ctx.drawImage(image, 0, newCaptionHeight - 1); // grey line hack
		gifBuilder.addFrame(ctx, {copy: true, delay: delay * 10});
	});

	return new Promise<Blob>((f) => {
		gifBuilder.on("finished", (blob: any) => {
			f(blob);
		});
		gifBuilder.render();
	});
}

async function renderStaticImage(
	caption: HTMLImageElement,
	gif: HTMLImageElement,
	canvas: HTMLCanvasElement,
	newCaptionHeight: number,
	ctx: CanvasRenderingContext2D
): Promise<Blob> {
	ctx.drawImage(caption, 0, 0, canvas.width, newCaptionHeight);
	ctx.drawImage(gif, 0, newCaptionHeight - 1); // grey line hack

	const result: Blob = await new Promise((a) => canvas.toBlob((blob) => a(blob!)));
	return result;
}
