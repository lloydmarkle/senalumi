import { appContext } from "../../context";
import type { Sound } from "../sound";

// If your button "click" action actually removes itself, make sure the
// use:audioQueue is BEFORE the on:click handler.
export function audioQueue(node: HTMLElement, key: keyof Sound['menu']) {
    const { audio } = appContext();

	let soundKey = key;
	const playSound = () => audio.menu[soundKey]();

	node.addEventListener('click', playSound);
	return {
		update(key: keyof Sound['menu']) {
			soundKey = key;
		},
		destroy() {
			node.removeEventListener('click', playSound);
		}
	};
}
