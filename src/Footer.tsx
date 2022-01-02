import {DiGithubAlt} from "react-icons/di";
import "./Footer.css";

export function GithubLink() {
	return (
		<a id="github-link" target="_blank" title="Github repository" href="https://github.com/jiftoo/gif/">
			<DiGithubAlt size={38} />
		</a>
	);
}
