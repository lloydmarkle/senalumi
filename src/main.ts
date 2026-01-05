import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

const svelteApp = mount(App, { target: document.getElementById('app') });
export default svelteApp
