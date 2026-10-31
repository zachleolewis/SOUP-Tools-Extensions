// The smallest useful extension: a tab that greets the signed-in player. It is written with React; SOUP's own copy of React runs
// it, so hooks work and nothing is bundled twice. The extension also offers an `api` that other extensions can call
// (`app.extensions.get("hello-world")?.api`), see examples/roster-consumer for the other side of that.
import { useEffect, useState } from "react";
import { Plugin } from "soup";
import "./styles.css";

function HelloView({ plugin }: { plugin: HelloWorld }) {
  const [who, setWho] = useState("nobody");
  const [count, setCount] = useState(0);

  useEffect(() => {
    // `identity()` is null when there is no Riot Client or nobody is signed in; it rejects only when something is broken.
    plugin.app.riot.identity().then(
      (me) => setWho(me?.name ?? "not signed in"),
      () => setWho("no Riot Client"),
    );
  }, []);

  return (
    <div className="hello-world-view">
      <p>{plugin.api.greet(who)}</p>
      <button onClick={() => setCount(count + 1)}>clicked {count} times</button>
    </div>
  );
}

export default class HelloWorld extends Plugin {
  /** What other extensions can call. */
  api = { greet: (name: string) => `Hello, ${name}!` };

  async onload() {
    this.addTab({ id: "hello", label: "Hello", icon: "Sparkles", order: 300, component: () => <HelloView plugin={this} /> });
    this.app.log.info("hello-world loaded");
  }
}
