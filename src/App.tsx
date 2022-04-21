import html2canvas from "html2canvas";
import {StatusCodes} from "http-status-codes";
import {ChangeEvent, FormEventHandler, useState} from "react";
import "./App.css";
import Config from "./Config";
// @ts-ignore
import isMobileBrowser from "./detectmobilebrowser";
import {GithubLink} from "./Footer";
import {renderImage, uploadToLitterbox} from "./GifRenderer";

export const IS_MOBILE = isMobileBrowser();

function isValidHttpUrl(string: string) {
	let url;
	try {
		url = new URL(string);
	} catch (_) {
		return false;
	}
	return url.protocol === "http:" || url.protocol === "https:";
}

interface FrameSelectorProps {
	onImageSelected: (url: string) => void;
}

enum UrlErrorMessage {
	NONE,
	INVALID = "This doesn't look like a valid url",
	NOT_AN_IMAGE = "This url doesn't link to an valid image",
	FORBIDDEN = "Forbidden (403)",
	TIMEOUT = "Request timeout",
	ERROR = "Unknown error while fetching url",
}

function FrameSelector({onImageSelected}: FrameSelectorProps) {
	const [urlErrorMessage, setUrlErrorMessage] = useState<UrlErrorMessage>(UrlErrorMessage.NONE);

	const fileInputHandler = ({target}: ChangeEvent<HTMLInputElement>) => {
		if (!target.files) return;

		const reader = new FileReader();
		reader.addEventListener("load", () => onImageSelected(reader.result as string));
		reader.readAsDataURL(target.files[0]);
	};
	const urlHandler = async (gifUrl: string) => {
		let resultError = UrlErrorMessage.NONE;
		if (isValidHttpUrl(gifUrl)) {
			const resp = await fetch(`${Config.CORS_PROXY_URL}?url=${gifUrl}`, {
				method: "GET",
			}).catch((err) => {
				console.log(`${Config.CORS_PROXY_URL}?url=${gifUrl}`);
				if (err.name === "AbortError") {
					resultError = UrlErrorMessage.TIMEOUT;
				} else {
					resultError = UrlErrorMessage.ERROR;
				}
				return null;
			});
			// Not sure if this even executes but who cares
			if (resp === null) {
				// empty
			} else if (resp.status === StatusCodes.FORBIDDEN) {
				resultError = UrlErrorMessage.FORBIDDEN;
			} else if (resp.status === StatusCodes.BAD_REQUEST) {
				resultError = UrlErrorMessage.INVALID;
			} else if (resp.status === StatusCodes.NOT_ACCEPTABLE || !resp.headers.get("Content-Type")?.startsWith("image")) {
				resultError = UrlErrorMessage.NOT_AN_IMAGE;
			} else {
				const imageBlob = await resp.blob();
				const reader = new FileReader();
				reader.addEventListener("load", () => onImageSelected(reader.result as string));
				reader.readAsDataURL(imageBlob);
			}
		} else {
			resultError = UrlErrorMessage.INVALID;
		}

		setUrlErrorMessage(resultError);
	};
	return (
		<label
			htmlFor="file-select-onclick"
			id="drop-area"
			onDragOver={(ev) => {
				ev.preventDefault();
			}}
			onDrop={(ev) => {
				ev.preventDefault();
				if (ev.dataTransfer.files.length && ev.dataTransfer.files[0].type.startsWith("image/")) {
					fileInputHandler({target: {files: ev.dataTransfer.files}} as any);
				}
			}}
		>
			<div id="drop-area-caption">
				<div>Drop your gif here</div>
				<div>or click to open file</div>
				<input
					onPaste={(ev) => {
						// @ts-ignore
						const clipboardData = ev.clipboardData || window.clipboardData;
						urlHandler(clipboardData.getData("text"));
					}}
					onKeyDown={(ev) => {
						if (ev.key === "Enter") {
							urlHandler(ev.currentTarget.value);
						}
					}}
					id="gif-url"
					placeholder="or paste the url (supports tenor)"
					type="url"
				/>
				{urlErrorMessage !== UrlErrorMessage.NONE && <div id="url-error">{urlErrorMessage}</div>}
			</div>
			<input
				id="file-select-onclick"
				type="file"
				accept="image/jpeg, image/png, image/gif"
				onClick={(ev) => console.log(ev.target)}
				onChange={(ev) => {
					console.log(ev.target);
					fileInputHandler(ev);
				}}
				style={{display: "none"}}
			></input>
		</label>
	);
}

enum ImageLinkState {
	EMPTY,
	PROCESSING,
	OK,
	ERR,
	BACKEND_ERROR,
}

interface FrameEditorProps {
	image: string;
	imageLinkState: ImageLinkState;
	imageLink: string | null;
	resetImage: () => void;
	saveImage: () => void;
	onTextChange: FormEventHandler<HTMLDivElement>;
}

function FrameEditor({image, imageLink, imageLinkState, onTextChange, resetImage, saveImage}: FrameEditorProps) {
	const [min, max] = [Config.CAPTION_FONT_SIZE_MIN, Config.CAPTION_FONT_SIZE_MAX].map((v) => v.toFixed(2));
	const mid = ((+min + +max) / 2).toFixed(2);
	const [range, setRange] = useState<number>(parseFloat(mid));
	return (
		<div id="edit-area">
			<div
				contentEditable
				suppressContentEditableWarning
				style={
					{
						"--caption-font-size": `calc(var(--caption-font-size-initial) * ${range})`,
					} as any
				}
				id="caption"
				onInput={onTextChange}
			>
				Caption
			</div>
			<img id="image" src={image} />
			<div id="controls">
				<div style={{textAlign: "center"}}>Font size multiplier</div>
				<input type="range" min={min} max={max} step={0.01} value={range} onChange={(ev) => setRange(+ev.currentTarget.value)}></input>
				<div id="range-labels">
					<div>{min}</div>
					<div>{mid}</div>
					<div>{max}</div>
				</div>
				<div id="control-buttons">
					<button id="reset-button" onClick={resetImage}>
						Reset
					</button>
					<button id="save-button" onClick={saveImage}>
						Generate
					</button>
				</div>
				{imageLinkState === ImageLinkState.PROCESSING && <div id="result-link">{"Generating image..."}</div>}
				{imageLinkState === ImageLinkState.BACKEND_ERROR && (
					<div id="result-link">
						{imageLink ? (
							<>
								<span>Could not upload to litterbox</span>
								<br />
								<br />
								{"Link to result: "}
								<a target="_blank" rel="noreferrer" href={imageLink}>
									{imageLink}
								</a>
								<br />
							</>
						) : (
							"Error creating image"
						)}
					</div>
				)}
				{imageLinkState !== ImageLinkState.EMPTY && imageLinkState !== ImageLinkState.PROCESSING && imageLinkState !== ImageLinkState.BACKEND_ERROR && (
					<>
						<div id="result-link">
							{imageLink ? (
								<>
									{"Link to result: "}
									<a target="_blank" rel="noreferrer" href={imageLink}>
										{imageLink}
									</a>
									<br />
									<small>(Deleted in 1 hour)</small>
								</>
							) : (
								"Error while creating image"
							)}
						</div>
						{imageLink && (
							<div id="ezgif-buttons">
								<a target="_blank" rel="noopener" href={`https://ezgif.com/optimize?url=${imageLink}`}>
									Optimize
								</a>
								<a target="_blank" rel="noopener" href={`https://ezgif.com/resize?url=${imageLink}`}>
									Resize
								</a>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}

function Frame() {
	const [image, setImage] = useState<string | null>(null);
	const [imageLink, setImageLink] = useState<string | null>(null);
	const [imageLinkState, setImageLinkState] = useState(ImageLinkState.EMPTY);

	const imageSelected = image !== null;

	const onTextChange = (ev: any) => {
		// unused
	};

	const captionElement = document.getElementById("caption")!;
	const saveImage = () => {
		setImageLinkState(ImageLinkState.PROCESSING);
		html2canvas(captionElement, {
			logging: false,
			scale: 3,
			windowWidth: 1000,
			windowHeight: 565,
		}).then(async (captionImage) => {
			const blob = await renderImage(image!, captionImage.toDataURL());
			const litterboxLink = await uploadToLitterbox(blob, captionElement.innerText);
			if (litterboxLink) {
				setImageLinkState(ImageLinkState.OK);
				setImageLink(litterboxLink);
			} else {
				setImageLinkState(ImageLinkState.BACKEND_ERROR);
				setImageLink(URL.createObjectURL(blob));
			}
		});
	};

	return (
		<>
			{!imageSelected && !IS_MOBILE && (
				<div id="header-container">
					<h1 id="header">Add text to animated GIF</h1>
				</div>
			)}
			<div
				id="frame"
				className={imageSelected ? "editor" : "selector"}
				onDragOver={(ev) => {
					ev.preventDefault();
					if (ev.dataTransfer.types.includes("Files")) {
						ev.currentTarget.classList.add("drag");
					}
				}}
				onDragLeave={(ev) => {
					ev.currentTarget.classList.remove("drag");
				}}
				onDrop={(ev) => {
					ev.currentTarget.classList.remove("drag");
				}}
			>
				{imageSelected ? (
					<FrameEditor
						imageLinkState={imageLinkState}
						imageLink={imageLink}
						image={image}
						onTextChange={onTextChange}
						resetImage={() => (setImage(null), setImageLinkState(ImageLinkState.EMPTY))}
						saveImage={saveImage}
					/>
				) : (
					<FrameSelector onImageSelected={setImage} />
				)}
				<GithubLink />
			</div>
		</>
	);
}

function App() {
	return (
		<>
			<Frame />
		</>
	);
}

export default App;
