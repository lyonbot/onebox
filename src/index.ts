import { render, createComponent } from 'solid-js/web';
import App from './App';
import 'virtual:uno.css';
import "dockview-core/dist/styles/dockview.css";
import "./global.scss"
import 'solid-devtools';

const app = document.getElementById('app')!
render(() => createComponent(App, {}), app);
