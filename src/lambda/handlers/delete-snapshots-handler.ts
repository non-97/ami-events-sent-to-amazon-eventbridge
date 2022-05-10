import {
  EC2Client,
  DescribeSnapshotsCommand,
  DeleteSnapshotCommand,
} from "@aws-sdk/client-ec2";
import { OriginalEventBase } from "../utils/event-bridge";
import * as AWSLambda from "aws-lambda";

interface AMIEvent extends OriginalEventBase {
  detail: {
    RequestId: string;
    ImageId: string;
    State: string;
    ErrorMessage: string;
  };
}

export const handler = async (
  amiEvent: AMIEvent,
  context: AWSLambda.Context
): Promise<void | Error> => {
  const client = new EC2Client({ region: process.env.AWS_REGION! });

  const describeSnapshotsCommand = new DescribeSnapshotsCommand({
    OwnerIds: [context.invokedFunctionArn.split(":")[4]],
    Filters: [
      {
        Name: "description",
        Values: [`*) for ${amiEvent.detail.ImageId}`],
      },
    ],
  });
  const describeSnapshotsCommandResponse = await client.send(
    describeSnapshotsCommand
  );

  console.log(
    `describeSnapshotsCommandResponse : ${JSON.stringify(
      describeSnapshotsCommandResponse,
      null,
      2
    )}`
  );

  describeSnapshotsCommandResponse.Snapshots?.map(async (snapshot) => {
    console.log(`delete snapshotId : ${snapshot.SnapshotId}`);
    const deleteSnapshotCommand = new DeleteSnapshotCommand({
      SnapshotId: snapshot.SnapshotId,
    });
    await client.send(deleteSnapshotCommand);
  });
};
