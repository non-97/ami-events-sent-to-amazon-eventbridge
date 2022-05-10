import { EC2Client, CopyImageCommand } from "@aws-sdk/client-ec2";
import { OriginalEventBase } from "../utils/event-bridge";

interface AMIEvent extends OriginalEventBase {
  detail: {
    RequestId: string;
    ImageId: string;
    State: string;
    ErrorMessage: string;
  };
}

export const handler = async (amiEvent: AMIEvent): Promise<void | Error> => {
  const client = new EC2Client({ region: process.env.DESTINATION_REGION! });

  const command = new CopyImageCommand({
    Name: amiEvent.detail.ImageId,
    SourceImageId: amiEvent.detail.ImageId,
    SourceRegion: amiEvent.region,
  });

  const response = await client.send(command);

  console.log(`response : ${JSON.stringify(response, null, 2)}`);
};
