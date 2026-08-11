---
name: what
description: Re-explain the preceding assistant message after the user indicates that they did not understand it.
disable-model-invocation: true
---

# Re-explain the preceding message

1. Pause the current task. Treat this invocation as feedback that the user did not understand the immediately preceding assistant message.
2. Re-explain the message from the last point established with the user. Include the context needed to connect that point to the current conclusion or proposed action. Do not only paraphrase the original message.
3. Use short sentences, active voice, and one consistent term for each concept. Define unfamiliar terms when they are necessary. Follow ASD-STE100 principles, but do not claim verified ASD-STE100 compliance.
4. Use the domain terms established in relevant local documentation. Read only the documentation needed to identify those terms if they are not already available in context.
5. Ask whether the explanation is now clear. Do not resume the paused task until the user responds.
