# Swarm Node

[![npm version](https://badge.fury.io/js/swarm-node.svg)](https://badge.fury.io/js/swarm-node)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

Swarm Node is a powerful Node.js library for creating and managing swarm-based AI agents. It provides a flexible and efficient way to orchestrate multiple AI agents for complex tasks and decision-making processes.

## Table of Contents
- [Swarm Node](#swarm-node)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Why Swarm Node?](#why-swarm-node)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [Documentation](#documentation)
  - [API Reference](#api-reference)
    - [`Swarm`](#swarm)
      - [Methods](#methods)
    - [`Agent`](#agent)
      - [Properties](#properties)
    - [`Response`](#response)
      - [Properties](#properties-1)
  - [Advanced Usage](#advanced-usage)
    - [Using the REPL](#using-the-repl)
    - [Streaming Responses](#streaming-responses)
  - [Testing and Debugging](#testing-and-debugging)
  - [FAQ](#faq)
  - [Roadmap](#roadmap)
    - [Short-term Goals (Next 3-6 months)](#short-term-goals-next-3-6-months)
    - [Medium-term Goals (6-12 months)](#medium-term-goals-6-12-months)
    - [Long-term Vision (12+ months)](#long-term-vision-12-months)
  - [Security](#security)
  - [Citation](#citation)
  - [Contributing](#contributing)
  - [License](#license)
  - [Support](#support)
  - [Acknowledgements](#acknowledgements)

## Features

- Create and manage swarms of AI agents
- Flexible agent configuration and customization
- Built-in REPL for interactive testing and development
- Streaming responses for real-time interaction
- Easy integration with existing Node.js projects

## Why Swarm Node?

Swarm Node stands out from other AI agent libraries due to its:
- Scalability: Easily manage hundreds or thousands of agents
- Flexibility: Customize agents for a wide range of tasks
- Efficiency: Optimized for performance in complex scenarios
- Integration: Seamlessly works with existing Node.js projects

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

## Documentation

For detailed documentation, including API reference and advanced usage examples, please visit our [official documentation site](https://jamiejackherer.github.io/swarm-node/).

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

## Testing and Debugging

Swarm Node comes with a comprehensive test suite. To run the tests:

```bash
npm run test
```

For debugging, you can use the `debug` option in the `run` method:

```typescript
const response = await swarm.run(agent, messages, {}, null, false, true);
```

This will output detailed logs of the swarm's decision-making process.

## FAQ

Q: Can Swarm Node be used in production environments?
A: Yes, Swarm Node is designed for both development and production use. However, always ensure you're following best practices for AI safety and ethics.

Q: How does Swarm Node handle rate limiting with underlying AI services?
A: Swarm Node implements intelligent rate limiting and retries to ensure optimal usage of AI services while respecting their constraints.

## Roadmap

We're actively developing Swarm Node to incorporate cutting-edge features and improve its capabilities. Here's our current roadmap:

### Short-term Goals (Next 3-6 months)
- [ ] Integrate OpenAI's Assistants API for enhanced agent capabilities
  - [ ] Implement function calling and tool use within swarms
  - [ ] Develop a system for managing and deploying custom assistants
- [ ] Implement Realtime API support for dynamic, streaming interactions
  - [ ] Add WebSocket support for real-time communication
  - [ ] Develop a pub/sub system for swarm events
- [ ] Enhance the REPL with autocomplete, syntax highlighting, and real-time debugging
- [ ] Implement multi-model support for diverse AI backends (GPT-4, Claude, etc.)
- [ ] Develop a plugin system for easy extensibility

### Medium-term Goals (6-12 months)
- [ ] Create a web-based dashboard for swarm monitoring and management
  - [ ] Implement real-time visualization of swarm activities
  - [ ] Add performance metrics and analytics
- [ ] Develop integrations with popular Node.js frameworks (Express, Nest.js, etc.)
- [ ] Implement a distributed swarm system for high-scalability scenarios
  - [ ] Add support for horizontal scaling across multiple nodes
  - [ ] Implement load balancing and fault tolerance
- [ ] Enhance memory management with advanced caching and retrieval systems
- [ ] Develop a library of pre-built swarm templates for common use cases
- [ ] Implement fine-tuning capabilities for custom swarm behaviors

### Long-term Vision (12+ months)
- [ ] Implement advanced swarm learning algorithms for continuous improvement
  - [ ] Develop self-optimizing swarms that adjust their structure and behavior
  - [ ] Implement cross-swarm learning and knowledge sharing
- [ ] Create a visual swarm designer tool for non-technical users
- [ ] Develop a marketplace for sharing and discovering custom agents and swarms
- [ ] Implement advanced natural language processing capabilities for improved agent communication
  - [ ] Add support for multi-language swarms and translation capabilities
- [ ] Develop tools for ethical AI governance and transparency in swarm decision-making
- [ ] Explore integration with emerging AI technologies (e.g., multimodal models, AGI frameworks)

We're committed to pushing the boundaries of swarm intelligence and welcome community input on our roadmap. If you have suggestions or want to contribute to any of these features, please open an issue or submit a pull request!

## Security

We take the security of Swarm Node seriously. If you discover any security-related issues, please email security@swarmnode.com instead of using the issue tracker.

## Citation

If you use Swarm Node in your research, please cite it as follows:

```
@software{swarm_node,
  title = {Swarm Node},
  author = {Jamie Jack},
  year = {2023},
  url = {https://github.com/jamiejackherer/swarm-node}
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

This project is licensed under a modified version of the GNU Affero General Public License (AGPL) version 3, with additional terms for commercial use. See the [LICENSE](LICENSE) file for details.

## Support

If you encounter any problems or have any questions, please open an issue on the GitHub repository.

## Acknowledgements

- OpenAI for providing the underlying language model capabilities
- The open-source community for inspiration and support
