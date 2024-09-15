import * as LINETypes from "../../../types/line_types.ts";
import { parseEnum } from "../../../types/thrift.ts";
import type { Client } from "../../client/index.ts";

const hasContents = ["IMAGE", "VIDEO", "AUDIO", "FILE"];

type splitInfo = {
	start: number;
	end: number;
	mention?: number;
	emoji?: number;
};

type decorationText = {
	text: string;
	emoji?: {
		productId: string;
		sticonId: string;
		version: number;
		resourceType: string;
		url: string;
	};
	mention?: {
		mid?: string;
		all?: true;
	};
};

type stkMeta = {
	STKPKGID: string;
	STKID: string;
	STKTXT: string;
	STKVER: string;
	STKOPT?: string;
};
type mentionMeta = {
	MENTION: {
		MENTIONEES: {
			M?: string;
			S: string;
			E: string;
			A?: string;
		}[];
	};
};
type emojiMeta = {
	REPLACE: {
		sticon: {
			resources: {
				S: number;
				E: number;
				productId: string;
				sticonId: string;
				version: number;
				resourceType: string;
			}[];
		};
	};
	STICON_OWNERSHIP: string[];
};
type contactMeta = {
	mid: string;
	displayName: string;
};
type flexMeta = {
	FLEX_VER: string;
	FLEX_JSON: Record<string, any>;
	ALT_TEXT: string;
	EFFECT_TAG?: string;
};

type fileMeta = {
	FILE_SIZE: string;
	FILE_EXPIRE_TIMESTAMP: string;
	FILE_NAME: string;
};
type imgExtMeta = {
	PREVIEW_URL: string;
	DOWNLOAD_URL: string;
};

/**
 * @description Gets mid's type
 */
function getMidType(mid: string): LINETypes.MIDType | null {
	/**
	 * USER(0),
	 * ROOM(1),
	 * GROUP(2),
	 * SQUARE(3),
	 * SQUARE_CHAT(4),
	 * SQUARE_MEMBER(5),
	 * BOT(6);
	 */
	const _u = mid.charAt(0);
	switch (_u) {
		case "u":
			return parseEnum("MIDType", 0) as LINETypes.MIDType;
		case "r":
			return parseEnum("MIDType", 1) as LINETypes.MIDType;
		case "c":
			return parseEnum("MIDType", 2) as LINETypes.MIDType;
		case "s":
			return parseEnum("MIDType", 3) as LINETypes.MIDType;
		case "m":
			return parseEnum("MIDType", 4) as LINETypes.MIDType;
		case "p":
			return parseEnum("MIDType", 5) as LINETypes.MIDType;
		case "v":
			return parseEnum("MIDType", 6) as LINETypes.MIDType;
		default:
			return null;
	}
}

export class Message {
	public sourceType: 0 | 1 | 2 | 3 | 4; // op noti recv send msg
	public rawSource:
		| LINETypes.Operation
		| LINETypes.SquareEventNotificationMessage
		| LINETypes.SquareEventReceiveMessage
		| LINETypes.SquareEventSendMessage
		| undefined;
	public rawMessage: LINETypes.Message;
	public toType: LINETypes.MIDType;
	public to: string;
	public fromType: LINETypes.MIDType;
	public from: string;
	public contentType: LINETypes.ContentType;
	public contentMetadata: Record<string, any>;
	public _senderDisplayName: string | undefined;
	public id: string;
	public createdTime: Date;
	public text: string | undefined;
	public content: string | undefined;

	constructor(options: {
		operation?: LINETypes.Operation;
		squareEventNotificationMessage?: LINETypes.SquareEventNotificationMessage;
		squareEventReceiveMessage?: LINETypes.SquareEventReceiveMessage;
		squareEventSendMessage?: LINETypes.SquareEventSendMessage;
		message?: LINETypes.Message;
	}) {
		if (Object.keys(options).length != 1) {
			throw new TypeError("Invalid argument");
		}
		const {
			message,
			operation,
			squareEventNotificationMessage,
			squareEventReceiveMessage,
			squareEventSendMessage,
		} = options;
		if (
			operation &&
			(operation.type === "SEND_MESSAGE" ||
				operation.type === 25 ||
				operation.type === "RECEIVE_MESSAGE" ||
				operation.type === 26 ||
				operation.type === "SEND_CONTENT" ||
				operation.type === 43)
		) {
			this.rawSource = operation;
			this.rawMessage = operation.message;
			this.sourceType = 0;
		} else if (squareEventNotificationMessage) {
			this.rawSource = squareEventNotificationMessage;
			this.rawMessage = squareEventNotificationMessage.squareMessage.message;
			this._senderDisplayName =
				squareEventNotificationMessage.senderDisplayName;
			this.sourceType = 1;
		} else if (squareEventReceiveMessage) {
			this.rawSource = squareEventReceiveMessage;
			this.rawMessage = squareEventReceiveMessage.squareMessage.message;
			this._senderDisplayName = squareEventReceiveMessage.senderDisplayName;
			this.sourceType = 2;
		} else if (squareEventSendMessage) {
			this.rawSource = squareEventSendMessage;
			this.rawMessage = squareEventSendMessage.squareMessage.message;
			this._senderDisplayName = squareEventSendMessage.senderDisplayName;
			this.sourceType = 3;
		} else if (message) {
			this.rawMessage = message;
			this.sourceType = 4;
		} else {
			throw new TypeError("Invalid argument");
		}
		this.toType =
			(parseEnum("MIDType", this.rawMessage.toType) as LINETypes.MIDType) ||
			this.rawMessage.toType;
		this.to = this.rawMessage.to;
		this.from = this.rawMessage._from;
		this.fromType = getMidType(this.from) as LINETypes.MIDType;
		this.contentType =
			(parseEnum(
				"ContentType",
				this.rawMessage.contentType,
			) as LINETypes.ContentType) || this.rawMessage.contentType;
		this.createdTime = new Date(this.rawMessage.createdTime);
		this.id = this.rawMessage.id;
		if (this.rawMessage.text) {
			this.content = this.rawMessage.text;
			this.text = this.rawMessage.text;
		}
		this.contentMetadata = {};
		for (const key in this.rawMessage.contentMetadata) {
			if (
				Object.prototype.hasOwnProperty.call(
					this.rawMessage.contentMetadata,
					key,
				)
			) {
				let value: any = this.rawMessage.contentMetadata[key];
				if (value.startsWith("{") || value.startsWith("[")) {
					value = JSON.parse(value);
				}
				this.contentMetadata[key] = value;
			}
		}
	}

	/**
	 * @return {string} sticker url
	 */
	public getSticker(): string {
		if (this.contentType !== "STICKER") {
			throw new Error("Not Sticker Message");
		}
		const stkData = this.contentMetadata as stkMeta;
		if (stkData.STKOPT === "A") {
			return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stkData.STKID}/android/sticker.png`;
		} else {
			return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stkData.STKID}/android/sticker_animation.png`;
		}
	}

	/**
	 * @return {string[]} emoji urls
	 */
	public getEmojis(): string[] {
		if (this.contentType !== "NONE") {
			throw new Error("Not Text Message");
		}
		const emojiUrls: string[] = [];
		const emojiData = this.contentMetadata as emojiMeta;
		emojiData.REPLACE.sticon.resources.forEach((e) => {
			emojiUrls.push(
				`https://stickershop.line-scdn.net/sticonshop/v1/sticon/${e.productId}/android/${e.sticonId}.png`,
			);
		});
		return emojiUrls;
	}

	/**
	 * @return {string[]} mention mids
	 */
	public getMentions(): string[] {
		if (this.contentType !== "NONE") {
			throw new Error("Not Text Message");
		}
		const mentionees: string[] = [];
		const mentionData = this.contentMetadata as mentionMeta;
		mentionData.MENTION.MENTIONEES.forEach((e) => {
			const mid = e.A ? "ALL" : e.M;
			if (mid) mentionees.push(mid);
		});
		return mentionees;
	}

	/**
	 * @description Gets text decorations (emoji,mention)
	 */
	public getTextDecorations(): decorationText[] {
		if (this.contentType !== "NONE") {
			throw new Error("Not Text Message");
		}
		const texts: decorationText[] = [];
		const splits: splitInfo[] = [];
		const mentionData = this.contentMetadata as mentionMeta;
		const emojiData = this.contentMetadata as emojiMeta;
		mentionData.MENTION.MENTIONEES.forEach((e, i) => {
			splits.push({ start: parseInt(e.S), end: parseInt(e.E), mention: i });
		});
		emojiData.REPLACE.sticon.resources.forEach((e, i) => {
			splits.push({ start: e.S, end: e.E, mention: i });
		});
		let lastSplit = 0;
		splits
			.sort((a, b) => a.start - b.start)
			.forEach((e) => {
				texts.push({
					text: this.content?.substring(lastSplit, e.start) as string,
				});
				const content: decorationText = {
					text: this.content?.substring(e.start, e.end) as string,
				};
				if (typeof e.emoji === "number") {
					const emoji = emojiData.REPLACE.sticon.resources[e.emoji];
					const url = `https://stickershop.line-scdn.net/sticonshop/v1/sticon/${emoji.productId}/android/${emoji.sticonId}.png`;
					content.emoji = {
						...emoji,
						url,
					};
				} else if (typeof e.mention === "number") {
					const mention = mentionData.MENTION.MENTIONEES[e.mention];
					content.mention = {
						mid: mention.M,
						all: mention.A ? true : undefined,
					};
				}
				texts.push(content);
				lastSplit = e.end;
			});
		return texts;
	}

	/**
	 * @return {contactMeta} contactData
	 */
	public getContact(): contactMeta {
		if (this.contentType !== "CONTACT") {
			throw new Error("Not Contact Message");
		}
		const contactData = this.contentMetadata as contactMeta;
		return { mid: contactData.mid, displayName: contactData.displayName };
	}

	/**
	 * @return flex data
	 */
	public getFlex(): {
		flexJson: Record<string, any>;
		altText: string;
		ver: string;
		tag: string | undefined;
	} {
		if (this.contentType !== "FLEX") {
			throw new Error("Not Flex Message");
		}
		const flexData = this.contentMetadata as flexMeta;
		return {
			flexJson: flexData.FLEX_JSON,
			altText: flexData.ALT_TEXT,
			ver: flexData.FLEX_VER,
			tag: flexData.EFFECT_TAG,
		};
	}

	/**
	 * @return {string} message id
	 */
	public getReply(): string | undefined {
		if (
			this.rawMessage.relatedMessageId &&
			(this.rawMessage.messageRelationType === 3 ||
				this.rawMessage.messageRelationType === "REPLY")
		) {
			return this.rawMessage.relatedMessageId;
		}
	}

	/**
	 * @return {} file infomation
	 */
	public getFileInfo(): {
		size: number;
		expire: Date;
		name: string;
	} {
		if (this.contentType !== "FILE") {
			throw new Error("Not File Message");
		}
		const fileData = this.contentMetadata as fileMeta;
		return {
			size: parseInt(fileData.FILE_SIZE),
			expire: new Date(parseInt(fileData.FILE_EXPIRE_TIMESTAMP)),
			name: fileData.FILE_NAME,
		};
	}
}

export class ClientMessage extends Message {
	protected client: Client;

	constructor(
		options: {
			operation?: LINETypes.Operation;
			squareEventNotificationMessage?: LINETypes.SquareEventNotificationMessage;
			squareEventReceiveMessage?: LINETypes.SquareEventReceiveMessage;
			squareEventSendMessage?: LINETypes.SquareEventSendMessage;
			message?: LINETypes.Message;
		},
		client: Client,
	) {
		super(options);
		this.client = client;
	}

	/**
	 * @return {Blob} message data
	 */
	public getData(preview?: boolean): Promise<Blob> {
		if (!hasContents.includes(this.contentType as string)) {
			throw new Error("message have no contents");
		}
		return this.client.getMessageObsData(this.id, preview);
	}
}

export class TalkMessage extends ClientMessage {
	constructor(
		options: { message?: LINETypes.Message; operation?: LINETypes.Operation },
		client: Client,
	) {
		super(options, client);
	}

	/**
	 * @return {Promise<LINETypes.Contact>} message author
	 */
	public getAuthor(): Promise<LINETypes.Contact> {
		return this.client.getContact({ mid: this.from });
	}

	/**
	 * @description groupTalk only
	 * @return {Promise<LINETypes.Chat>} Chat(group)
	 */
	public getGroup(): Promise<LINETypes.Chat> | undefined {
		if (this.toType === "GROUP" || this.toType === "ROOM") {
			return this.client.getChats({ gids: [this.to] }).then((e) => {
				return e.chats[0] as LINETypes.Chat;
			});
		}
	}

	/**
	 * @description userTalk only
	 * @return {Promise<LINETypes.Contact>} Contact
	 */
	public getUser(): Promise<LINETypes.Contact> | undefined {
		if (this.toType === "USER") {
			if (this.getAuthorIsMe()) {
				return this.client.getContact({ mid: this.to });
			} else {
				return this.client.getContact({ mid: this.from });
			}
		}
	}

	/**
	 * @description Gets author is me
	 */
	public getAuthorIsMe(): boolean {
		return this.from === this.client.user?.mid;
	}

	/**
	 * @description Sends in this talk
	 */
	public send(options: {
		to?: string;
		text?: string | undefined;
		contentType?: number | undefined;
		contentMetadata?: any;
		relatedMessageId?: string | undefined;
		location?: any;
		chunk?: string[] | undefined;
		e2ee?: boolean | undefined;
	}): Promise<LINETypes.Message> {
		options.to =
			this.toType === "GROUP" || this.toType === "ROOM"
				? this.to
				: this.getAuthorIsMe()
					? this.to
					: this.from;
		return this.client.sendMessage(options as any);
	}

	/**
	 * @description Sends in this talk with replying this message
	 */
	public reply(options: {
		to?: string;
		text?: string | undefined;
		contentType?: number | undefined;
		contentMetadata?: any;
		relatedMessageId?: string | undefined;
		location?: any;
		chunk?: string[] | undefined;
		e2ee?: boolean | undefined;
	}): Promise<LINETypes.Message> {
		options.to =
			this.toType === "GROUP" || this.toType === "ROOM"
				? this.to
				: this.getAuthorIsMe()
					? this.to
					: this.from;
		options.relatedMessageId = this.id;
		return this.client.sendMessage(options as any);
	}

	/**
	 * @description React to this message
	 */
	public react(
		type: LINETypes.MessageReactionType,
	): Promise<LINETypes.ReactToMessageResponse> {
		if (typeof type === "string") {
			type = LINETypes.MessageReactionType[type];
		}
		return this.client.reactToMessage({
			reactionType: type as LINETypes.MessageReactionType,
			messageId: this.id,
		});
	}

	/**
	 * @description Announce this message
	 */
	public announce() {
		if (!this.text) {
			throw new Error("not Text message");
		}
		if (this.toType !== "ROOM" && this.toType !== "GROUP") {
			throw new Error("not Text message");
		}
		return this.client.createChatRoomAnnouncement({
			chatRoomMid: this.to,
			text: this.text,
			link: `line://nv/chatMsg?chatId=${this.to}&messageId=${this.id}`,
		});
	}
}

export class SquareMessage extends ClientMessage {
	constructor(
		options: {
			squareEventNotificationMessage?: LINETypes.SquareEventNotificationMessage;
			squareEventReceiveMessage?: LINETypes.SquareEventReceiveMessage;
			squareEventSendMessage?: LINETypes.SquareEventSendMessage;
			message?: LINETypes.Message;
		},
		client: Client,
	) {
		super(options, client);
	}

	/**
	 * @return {Promise<LINETypes.GetSquareMemberResponse>} message author
	 */
	public getAuthor(): Promise<LINETypes.GetSquareMemberResponse> {
		return this.client.getSquareMember({ squareMemberMid: this.from });
	}

	/**
	 * @return {Promise<LINETypes.GetSquareChatResponse>} this squareChat
	 */
	public getSquareChat(): Promise<LINETypes.GetSquareChatResponse> {
		return this.client.getSquareChat({ squareChatMid: this.to });
	}

	/**
	 * @return {Promise<LINETypes.GetSquareResponse>} this square
	 */
	public async getSquare(): Promise<LINETypes.GetSquareResponse> {
		return await this.client.getSquare({
			squareMid: (await this.getSquareChat()).squareChat.squareMid,
		});
	}

	/**
	 * @description Gets author is me
	 */
	public async getAuthorIsMe(): Promise<boolean> {
		return (
			this.from ===
			(await this.getSquareChat()).squareChatMember.squareMemberMid
		);
	}

	public async getMySquareProfile(): Promise<LINETypes.SquareMember> {
		return (await this.getSquare()).myMembership;
	}
	/**
	 * @description Sends in this squareChat
	 */
	public send(
		options: {
			squareChatMid?: string;
			text?: string | undefined;
			contentType?: any;
			contentMetadata?: any;
			relatedMessageId?: string | undefined;
		},
		safe: boolean = true,
	): Promise<LINETypes.SendMessageResponse> {
		options.squareChatMid = this.to;
		return this.client.sendSquareMessage(options as any, safe);
	}

	/**
	 * @description Sends in this squareChat with replying this message
	 */
	public reply(
		options: {
			squareChatMid?: string;
			text?: string | undefined;
			contentType?: any;
			contentMetadata?: any;
			relatedMessageId?: string | undefined;
		},
		safe: boolean = true,
	): Promise<LINETypes.SendMessageResponse> {
		options.squareChatMid = this.to;
		options.relatedMessageId = this.id;
		return this.client.sendSquareMessage(options as any, safe);
	}

	/**
	 * @description React to this message
	 */
	public react(
		type: LINETypes.MessageReactionType,
	): Promise<LINETypes.ReactToMessageResponse> {
		if (typeof type === "string") {
			type = LINETypes.MessageReactionType[type];
		}
		return this.client.reactToSquareMessage({
			squareChatMid: this.to,
			reactionType: type as LINETypes.MessageReactionType,
			squareMessageId: this.id,
		});
	}

	/**
	 * @description Announce this message
	 */
	public announce() {
		if (!this.text) {
			throw new Error("not Text message");
		}
		return this.client.createSquareChatAnnouncement({
			squareChatMid: this.to,
			senderSquareMemberMid: this.from,
			squareMessageId: this.id,
			text: this.text,
			createdAt: this.rawMessage.createdTime,
			announcementType: 0,
		});
	}
}
