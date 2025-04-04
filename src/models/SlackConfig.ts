import mongoose, { Schema, Document, Model } from 'mongoose';

// Replace empty interface with Record type or add methods
type ISlackConfigMethods = Record<string, never>;

// Fix empty object type by using Record<string, never>
interface SlackConfigModel extends Model<ISlackConfig, Record<string, never>, ISlackConfigMethods> {
  getSingletonConfig(): Promise<ISlackConfig | null>;
  updateConfig(configData: Partial<ISlackConfig>): Promise<ISlackConfig>;
}

export interface ISlackConfig extends Document {
  token: string;
  channelId: string;
  enabled: boolean;
  dayRange: number;  // How many days of leave requests to send
  scheduleEnabled: boolean; // Whether to send scheduled messages
  scheduleTime: string;    // Time of day to send scheduled messages (HH:MM format)
  scheduleWorkdaysOnly: boolean; // Whether to send only on workdays (Mon-Fri)
  createdAt: Date;
  updatedAt: Date;
}

const SlackConfigSchema: Schema = new Schema(
  {
    token: {
      type: String,
      required: [true, 'Slack token is required'],
    },
    channelId: {
      type: String,
      required: [true, 'Slack channel ID is required'],
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    dayRange: {
      type: Number,
      default: 3,
      min: 1,
      max: 30,
    },
    scheduleEnabled: {
      type: Boolean,
      default: true,
    },
    scheduleTime: {
      type: String,
      default: '08:30',
      validate: {
        validator: function(v: string) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: (props: { value: string }) => `${props.value} is not a valid time format! Use HH:MM format.`
      }
    },
    scheduleWorkdaysOnly: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Make sure there's only one config record by using a singleton pattern
SlackConfigSchema.statics.getSingletonConfig = async function() {
  const configs = await this.find().sort({ createdAt: -1 }).limit(1);
  return configs.length > 0 ? configs[0] : null;
};

// Create or update the singleton config
SlackConfigSchema.statics.updateConfig = async function(configData: Partial<ISlackConfig>) {
  const existingConfig = await this.find().sort({ createdAt: -1 }).limit(1);
  
  if (existingConfig.length > 0) {
    return this.findByIdAndUpdate(existingConfig[0]._id, configData, { new: true });
  } else {
    return this.create(configData);
  }
};

export default (mongoose.models.SlackConfig as SlackConfigModel) || 
  mongoose.model<ISlackConfig, SlackConfigModel>('SlackConfig', SlackConfigSchema);
