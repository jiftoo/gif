const express = require("express");
const app = express();
const FormData = require("form-data");
const cors = require("cors");
const {StatusCodes} = require("http-status-codes");
const multer = require("multer");
const fetch = require("node-fetch");
const chalk = require("chalk");

let upload = multer();

async function readBodyAsBuffer(req) {
	return new Promise((resolve, reject) => {
		let buffer = Buffer.alloc(0);
		req.setEncoding(null);
		req.on("data", (chunk) => (buffer = Buffer.concat([buffer, Buffer.from(chunk)])));
		req.on("end", () => resolve(buffer));
		req.on("error", reject);
	});
}

app.use(
	cors({
		origin: ["https://jiftoo.dev", "http://localhost:3000"],
	})
);

app.get("/gif/cors", async (req, resp) => {
	//#region URL creation and validation
	const urlstring = req.query.url;
	if (!urlstring) {
		resp.status(StatusCodes.BAD_REQUEST).send("'url' parameter missing");
		console.log("bad request", "parameter missing", chalk.cyanBright(url.toString()));
		return;
	}
	let url;
	try {
		url = new URL(urlstring);
	} catch (err) {
		resp.status(StatusCodes.BAD_REQUEST).send("malformed url");
		console.log("bad request", "malformed url", chalk.cyanBright(url.toString()));
		return;
	}
	//#endregion

	//#region tenor fetch
	if (url.hostname === "tenor.com") {
		const id = url.pathname.split("-").pop();
		const response = await fetch(`https://g.tenor.com/v1/gifs?ids=${id}&key=PC8YFJOK96O7&media_filter=gif&limit=1`);
		if (response.ok) {
			const json = await response.json();
			// changing url
			url = new URL(json.results[0].media[0].gif.url);
		} else {
			resp.status(StatusCodes.NOT_ACCEPTABLE).send("tenor.com error");
			console.error("not acceptable", "tenor.com error", chalk.cyanBright(url.toString()));
			return;
		}
	}
	//#endregion

	try {
		const result = await fetch(url, {
			timeout: 4000,
			method: "GET",
		});
		if (!result.headers.get("Content-Type").startsWith("image")) {
			resp.status(StatusCodes.NOT_ACCEPTABLE).send("url does not resolve to an image");
			console.error("not acceptable", "no image", chalk.cyanBright(url.toString()), chalk.bgRed(result.headers.get("Content-Type")));
			return;
		}
		result.headers.forEach((v, k) => resp.setHeader(k, v));
		result.body.pipe(resp);
		console.log("proxied", url.toString());
	} catch (error) {
		if (error.type === "request-timeout") {
			resp.sendStatus(StatusCodes.REQUEST_TIMEOUT);
			console.error("timeout", "tenor.com error");
		} else {
			resp.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
		}
	}
});

app.post(
	"/gif/litterbox",
	express.raw({
		limit: "54mb",
		type: "image/*",
	}),
	async (req, resp) => {
		const data = req.body; //await readBodyAsBuffer(req);

		const formData = new FormData();
		formData.append("fileToUpload", data, `file.${req.headers["content-type"].split("/")[1]}`);
		formData.append("time", "1h");
		formData.append("reqtype", "fileupload");

		const result = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
			method: "POST",
			body: formData,
		})
			.then((r) => r.text())
			.catch((err) => {
				console.error("Error uploading image!", err);
				resp.status(500);
				resp.send("Error");
			});

		if (result.startsWith("http")) {
			console.log(`Uploaded image: ${result}`);
			resp.status(200);
			resp.send(result);
		}
	}
);

const port = 8002;

app.listen(port);
console.log("Listening on", port);
