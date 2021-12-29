const express = require("express");
const app = express();
const {Blob} = require("buffer");
const FormData = require("form-data");
const {createReadStream} = require("fs");
const http = require("http");
const cors = require("cors");
const {Readable} = require("stream");
const multer = require("multer");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

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

async function streamToString(stream) {
	// lets have a ReadableStream as a stream variable
	const chunks = [];

	for await (const chunk of stream) {
		chunks.push(Buffer.from(chunk));
	}

	return Buffer.concat(chunks).toString("utf-8");
}

app.use(cors());
app.post(
	"/gifcaptioner",
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
		}).then((r) => r.text());

		if (result.startsWith("http")) {
			console.log(`Uploaded image: ${result}`);
			resp.status(200);
			resp.send(result);
		} else {
			console.error("Error uploading image!");
			resp.status(500);
			resp.send("Error");
		}
	}
);

app.listen(8002);
console.log("Listening");

// server.on("request", (req, res) => {
//     console.log("request!!")
//     const connector = http.request({
//         host: "uguu.se",
//         path: '/api.php?d=upload-tool',
//         method: 'POST',
//         headers: req.headers,
//         body: req.body
//     }, (resp) => {
//         resp.pipe(bl(function (err, data) {
//             if (err) { return console.error(err) }
//             data = data.toString()
//             console.log(data)
//         }));
//         resp.pipe(res);
//     });
//     res.setHeader('Access-Control-Allow-Origin', '*');
//     req.pipe(connector);
// })
