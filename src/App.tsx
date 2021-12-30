import html2canvas from "html2canvas";
import {ChangeEvent, FormEventHandler, useState} from "react";
import "./App.css";
import {GithubLink} from "./Footer";
import {renderImage} from "./GifRenderer";

function isValidHttpUrl(string: string) {
	let url;
	try {
		url = new URL(string);
	} catch (_) {
		return false;
	}
	return url.protocol === "http:" || url.protocol === "https:";
}

const getHeightAndWidthFromDataUrl = (dataURL: string | null) =>
	new Promise<any>((resolve, reject) => {
		if (!dataURL) {
			reject("dataURL is null");
			return;
		}
		const img = new Image();
		img.onload = () => {
			resolve({
				height: img.height,
				width: img.width,
			});
		};
		img.src = dataURL;
	});

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
			const resp = await fetch(gifUrl, {
				method: "GET",
			}).catch((err) => {
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
			} else if (resp.status === 403) {
				resultError = UrlErrorMessage.FORBIDDEN;
			} else if (!resp.headers.get("Content-Type")?.startsWith("image/")) {
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
		<label id="drop-area">
			<div
				id="drop-overlay"
				style={{position: "absolute", top: 0, bottom: 0, left: 0, right: 0}}
				onDragOver={(ev) => {
					ev.preventDefault();
				}}
				onDrop={(ev) => {
					ev.preventDefault();
					if (ev.dataTransfer.files.length && ev.dataTransfer.files[0].type.startsWith("image/")) {
						fileInputHandler({target: {files: ev.dataTransfer.files}} as any);
					}
				}}
			></div>
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
					placeholder="or paste the url"
					type="url"
				/>
				{urlErrorMessage !== UrlErrorMessage.NONE && <div id="url-error">{urlErrorMessage}</div>}
			</div>
			<input type="file" accept="image/jpeg, image/png, image/gif" onChange={fileInputHandler} style={{display: "none"}}></input>
		</label>
	);
}

enum ImageLinkState {
	EMPTY,
	PROCESSING,
	OK,
	ERR,
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
	const [range, setRange] = useState(1);
	const [min, max] = [0.25, 3].map((v) => v.toFixed(2));
	const mid = ((+min + +max) / 2).toFixed(2);
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
				<input type="range" min={min} max={max} step={0.01} value={range} onChange={(ev) => setRange(+ev.target.value)}></input>
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
						Save
					</button>
				</div>
				{imageLinkState === ImageLinkState.PROCESSING && <div id="result-link">{"Creating image..."}</div>}
				{imageLinkState !== ImageLinkState.EMPTY && imageLinkState !== ImageLinkState.PROCESSING && (
					<>
						<div id="result-link">
							{imageLink ? (
								<>
									{"Link to result: "}
									<a target="_blank" referrerPolicy="no-referrer" href={imageLink}>
										{imageLink}
									</a>
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
	const [caption, setCaption] = useState("Caption");
	const [aspectRatio, setAspectRatio] = useState("1");
	const [imageLink, setImageLink] = useState<string | null>(null);
	const [imageLinkState, setImageLinkState] = useState(ImageLinkState.EMPTY);

	const imageSelected = image !== null;

	const onTextChange = (ev: any) => {
		const target = ev.target as HTMLDivElement;
		console.log(ev.target.innerText);
		setCaption(ev.target.innerText);

		const el = document.getElementById("image");
		console.log(el!.clientWidth, el!.clientHeight);
	};

	const saveImage = () => {
		setImageLinkState(ImageLinkState.PROCESSING);
		html2canvas(document.getElementById("caption")!, {
			logging: false,
			scale: 3,
			windowWidth: 1000,
			windowHeight: 565,
		}).then(async (captionImage) => {
			const result = await renderImage(image!, captionImage.toDataURL());
			setImageLinkState(result ? ImageLinkState.OK : ImageLinkState.ERR);
			setImageLink(result);
		});
	};

	return (
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
	);
}

function App() {
	return (
		<div id="app">
			<Frame />
		</div>
	);
}

export default App;
