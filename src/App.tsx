import html2canvas from "html2canvas";
import { ChangeEvent, FormEventHandler, useState } from "react";
import "./App.css";
import { renderImage } from "./GifRenderer";

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

function FrameSelector({onImageSelected}: FrameSelectorProps) {
	const fileInputHandler = ({target}: ChangeEvent<HTMLInputElement>) => {
		if (!target.files) return;

		const reader = new FileReader();
		reader.addEventListener("load", () => onImageSelected(reader.result as string));
		reader.readAsDataURL(target.files[0]);
	};
	return (
		<label id="drop-area">
			<div
				id="drop-area-caption"
				onDragOver={(ev) => ev.preventDefault()}
				onDrop={(ev) => {
					ev.preventDefault();
					fileInputHandler({target: {files: ev.dataTransfer.files}} as any);
				}}
			>
				<div>Drop your gif here</div>
				<div>or click to open file</div>
			</div>
			<input type="file" accept="image/jpeg, image/png, image/gif" onChange={fileInputHandler} style={{display: "none"}}></input>
		</label>
	);
}

enum ImageLinkState {
	EMPTY,
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
				{imageLinkState !== ImageLinkState.EMPTY && (
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
