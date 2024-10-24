# Swarm Node

Swarm Node is a powerful Node.js library for creating and managing swarm-based AI agents. It provides a flexible and efficient way to orchestrate multiple AI agents for complex tasks and decision-making processes.

## Features

- Create and manage swarms of AI agents
- Flexible agent configuration and customization
- Built-in REPL for interactive testing and development
- Streaming responses for real-time interaction
- Easy integration with existing Node.js projects

## Installation

You can install Swarm Node using npm or Bun:

```bash
npm install swarm-node
# or
bun add swarm-node
```

## Quick Start

Here's a simple example to get you started with Swarm Node:

```typescript
import { Swarm, Agent } from 'swarm-node';

const swarm = new Swarm();

const agent: Agent = {
  name: "ExampleAgent",
  role: "assistant",
  backstory: "I am a helpful AI assistant.",
  goals: ["Provide accurate information", "Assist with tasks"]
};

const messages = [{ role: "user", content: "Hello, can you help me?" }];

const response = await swarm.run(agent, messages);
console.log(response.messages[0].content);
```

## API Reference

### `Swarm`

The main class for creating and managing swarms of agents.

#### Methods

- `run(agent: Agent, messages: Message[], contextVariables?: Record<string, any>, functions?: Function[], stream?: boolean, debug?: boolean): Promise<Response>`

### `Agent`

An interface representing an AI agent in the swarm.

#### Properties

- `name: string`
- `role: string`
- `backstory: string`
- `goals: string[]`

### `Response`

An interface representing the response from an agent.

#### Properties

- `messages: Message[]`
- `agent: Agent`

## Advanced Usage

For more advanced usage, including streaming responses and using the built-in REPL, check out the examples in the `examples/` directory.

### Using the REPL

Swarm Node comes with a built-in REPL for interactive development and testing. To use it:

```typescript
import { runDemoLoop } from 'swarm-node';

const agent: Agent = {
  name: "REPLAgent",
  role: "assistant",
  backstory: "I am an AI assistant in a REPL environment.",
  goals: ["Assist users interactively", "Provide real-time responses"]
};

runDemoLoop(agent);
```

### Streaming Responses

To get streaming responses from your agents:

```typescript
const streamingResponse = await swarm.run(agent, messages, {}, null, true);

for await (const chunk of streamingResponse) {
  if (chunk.content) {
    console.log(chunk.content);
  }
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any problems or have any questions, please open an issue on the GitHub repository.

## Acknowledgements

- OpenAI for providing the underlying language model capabilities
- The open-source community for inspiration and support
