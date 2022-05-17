const express = require("express");
const app = express();
const FormData = require("form-data");
const cors = require("cors");
const {StatusCodes} = require("http-status-codes");
const fetch = require("node-fetch");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");

async function saveImage(caption, body, litterboxLink) {
	const savePath = "./gifs";
	const invalidChRegex = /([^a-z0-9 ]+)/gi;
	const formattedName = caption.replaceAll(invalidChRegex, "-").substring(0, 50);
	const formattedTimestamp = new Date().toISOString().replaceAll(":", ".");

    // formattedTimestamp goes first to be able to sort by date.
	fs.writeFile(path.join(savePath, `${formattedTimestamp}-${formattedName}.png`), Buffer.from(body, "binary"), {flag: "w"}, (err) => {
		const litterboxLogMessage = !!litterboxLink ? "and uploaded" : "and not uploaded";
		if (err) {
			console.log(
				"Not saved",
				litterboxLogMessage,
				chalk.yellowBright(formattedName),
				litterboxLink ? `to ${litterboxLink} at` : "at",
				chalk.red(formattedTimestamp) + ":",
				err.message
			);
		} else {
			console.log("Saved", litterboxLogMessage, chalk.yellowBright(formattedName), litterboxLink ? `to ${litterboxLink} at` : "at", chalk.red(formattedTimestamp));
		}
	});
}

app.use(
	cors({
		origin: ["https://api.jiftoo.dev", "https://jiftoo.dev"],
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

		let litterboxLink = null;

		const result = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
			method: "POST",
			body: formData,
		})
			.then((r) => r.text())
			.catch((err) => {
				console.error(err);
				resp.status(500);
				resp.send("Error");
			});

		if (result?.startsWith("http")) {
			resp.status(200);
			resp.send(result);
			litterboxLink = result;
		}

		saveImage(req.headers["image-caption"], data, litterboxLink);
	}
);

const port = 8002;

app.listen(port);
console.log("Listening on", port);
