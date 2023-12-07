# Bull to BullMQ

## Description

This codemod makes basic necessary changes to migrate from bull to bullmq. There is one change that you will absolutely have to make by yourself which is creating queue names for the queues that your application has. Then, these names will have to be used for the created workers in the files where you previously used `.process()`.
Same goes for Worker object queue names. They cannot be inferred from the queue name automatically, since we have no runtime way of checking against the file that queue is being imported in, and it might be instantiated using arbitrary factories, which would make the lookup chain too complex.
Another manual change that has to be done is manual connection object correction as it can't be correctly inferred from all the possible options of assigning it. The syntax errors will be left intentionally. See examples below for better understanding.

## Example

### Before

```ts
import Queue from 'bull';
import Redis from 'ioredis';

export function createQueue(
	name: string,
	defaultJobOptions?: Partial<Queue.JobOptions>,
) {
	const queue = new Queue(name, {
		createClient(type) {
			switch (type) {
				case 'client':
					return Redis.defaultClient;

				case 'subscriber':
					return Redis.defaultSubscriber;

				case 'bclient':
			    return new Redis(env.REDIS_URL);

				default:
					throw new Error(`Unexpected connection type: ${type}`);
			}
		},
		defaultJobOptions: {
			removeOnComplete: true,
			removeOnFail: true,
			...defaultJobOptions,
		},
	});
	queue.on('stalled', () => {
		Metrics.increment("bull.jobs.stalled");
	});
	queue.on('completed', () => {
		Metrics.increment("bull.jobs.completed");
	});
	queue.on('error', () => {
		Metrics.increment("bull.jobs.errored");
	});
	queue.on('failed', () => {
		Metrics.increment("bull.jobs.failed");
	});

	return queue;
}

const queue = createQueue('queue-name');

queue.process(
	async function (job) {
		const event = job.data;
	},
);

```

### After

```ts
import { Queue, DefaultJobOptions, QueueEvents, Worker } from "bullmq";
import Redis from 'ioredis';

export function createQueue(
  name: string,
  defaultJobOptions?: Partial<DefaultJobOptions>,
) {
    const queue = new Queue(name, {
      connection: { host: , port:  },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
        ...defaultJobOptions,
      }
    });
    const queueEvents = new QueueEvents(name);
    queueEvents.on('stalled', () => {
      Metrics.increment("bull.jobs.stalled");
    });
    queueEvents.on('completed', () => {
      Metrics.increment("bull.jobs.completed");
    });
    queueEvents.on('error', () => {
      Metrics.increment("bull.jobs.errored");
    });
    queueEvents.on('failed', () => {
      Metrics.increment("bull.jobs.failed");
    });

    return queue;
}

const queue = createQueue('queue-name');

const worker = new Worker("unknown-name", async function (job) {
  const event = job.data;
});
```

## Applicability Criteria

Application running bull queue jobs.

## Other Metadata

### Codemod Version

v1.0.0

### Change Mode

**Assistive**: The automation partially completes changes. Human involvement is needed to make changes ready to be pushed and merged.

### **Codemod Engine**

[jscodeshift](https://github.com/facebook/jscodeshift)

### Estimated Time Saving

Largely depends on the codebase size. Usually, up to 5 minutes per queue with one single job. Another 5 minutes for changing the way jobs are being started in bullmq.

### Owner

[Intuita](https://github.com/intuita-inc)

### Links for more info


