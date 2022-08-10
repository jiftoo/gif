// TODO: uninstall gif libraries

// @ts-ignore
import GIF from "gif.js.optimized";
import {GifReader} from "omggif";
import {IS_MOBILE} from "./App";
import Config from "./Config";

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

export async function uploadToLitterbox(blob: Blob, caption: string) {
	const response = await fetch(Config.LITTERBOX_API_URL, {
		method: "POST",
		mode: "cors",
		headers: {
			"image-caption": caption.trim(),
		},
		body: blob,
	}).catch((err) => console.error("litterbox failure:", err));

	if (response?.ok) {
		return await response.text();
	} else {
		return null;
	}
}

export async function renderImage(mainImage: string, captionImage: string): Promise<Blob> {
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
	gif.width = Math.max(Config.MIN_WIDTH, gif.width);
	gif.src = mainImage;
	caption.src = captionImage;
	console.log(gif);
	await promise;

	const captionAr = caption.width / caption.height;
	const newCaptionHeight = gif.width * (1 / captionAr); // grey line hack

	const canvas = document.createElement("canvas");
	canvas.width = gif.width;
	canvas.height = gif.height + newCaptionHeight;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw Error("No 2d context");
	}

	let blob: Blob | null = null;
	if (mainImage.startsWith("data:image/gif")) {
		blob = await renderGif(caption, gif, canvas, newCaptionHeight, ctx);
	} else {
		blob = await renderStaticImage(caption, gif, canvas, newCaptionHeight, ctx);
	}

	return blob;
}

async function renderGif(caption: HTMLImageElement, gif: HTMLImageElement, canvas: HTMLCanvasElement, newCaptionHeight: number, ctx: CanvasRenderingContext2D): Promise<Blob> {
	const frames = await loadGifFrames(gif.src);

	let workers = Config.DEFAULT_WORKERS;
	if (!IS_MOBILE) {
		workers = Math.max(window.navigator.hardwareConcurrency - 1, workers);
	}

	console.log("Using", workers, "workers");

	const gifBuilder = new GIF({workers: workers, quality: Config.GIF_QUALITY, width: canvas.width, height: canvas.height});

	frames.forEach(([image, delay], i) => {
		console.log("width", canvas.width);
		console.log("Painting gif frames:", i, "/", frames.length);
		ctx.drawImage(caption, 0, 0, canvas.width, Math.round(newCaptionHeight));
		ctx.drawImage(image, 0, newCaptionHeight, Math.max(Config.MIN_WIDTH, image.width), image.height);
		gifBuilder.addFrame(ctx, {copy: true, delay: delay * 10});
	});

	return new Promise<Blob>((f) => {
		gifBuilder.on("progress", (p: number) => console.log("Building gif:", (p * 100).toFixed(1)));
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
	ctx.drawImage(gif, 0, newCaptionHeight);

	const result: Blob = await new Promise((a) => canvas.toBlob((blob) => a(blob!)));
	return result;
}
