import { storage } from '../storage';
import type { InsertNotification, NotificationSettings } from '@shared/schema';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

interface SendNotificationOptions {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels?: ('in_app' | 'email' | 'sms' | 'push')[];
}

interface EmailConfig {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SmsConfig {
  to: string;
  body: string;
}

type EmailProvider = 'aws' | 'sendgrid' | 'none';
type SmsProvider = 'aws' | 'twilio' | 'none';

class NotificationService {
  private twilioClient: any = null;
  private sendgridClient: any = null;
  private sesClient: SESClient | null = null;
  private snsClient: SNSClient | null = null;
  private emailProvider: EmailProvider = 'none';
  private smsProvider: SmsProvider = 'none';

  constructor() {
    this.initializeClients();
  }

  private initializeClients() {
    // Initialize AWS SES for email (preferred)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION) {
      try {
        this.sesClient = new SESClient({
          region: process.env.AWS_REGION,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        });
        this.emailProvider = 'aws';
        console.log('AWS SES client initialized');
      } catch (error) {
        console.log('AWS SES client initialization failed:', error);
      }
    }

    // Initialize AWS SNS for SMS (preferred)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION) {
      try {
        this.snsClient = new SNSClient({
          region: process.env.AWS_REGION,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        });
        this.smsProvider = 'aws';
        console.log('AWS SNS client initialized');
      } catch (error) {
        console.log('AWS SNS client initialization failed:', error);
      }
    }

    // Fallback to SendGrid for email
    if (this.emailProvider === 'none' && process.env.SENDGRID_API_KEY) {
      try {
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        this.sendgridClient = sgMail;
        this.emailProvider = 'sendgrid';
        console.log('SendGrid client initialized (fallback)');
      } catch (error) {
        console.log('SendGrid client not available');
      }
    }

    // Fallback to Twilio for SMS
    if (this.smsProvider === 'none' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        const twilio = require('twilio');
        this.twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        this.smsProvider = 'twilio';
        console.log('Twilio client initialized (fallback)');
      } catch (error) {
        console.log('Twilio client not available');
      }
    }

    console.log(`Notification providers - Email: ${this.emailProvider}, SMS: ${this.smsProvider}`);
  }

  async send(options: SendNotificationOptions): Promise<void> {
    const { userId, type, title, message, data, channels = ['in_app'] } = options;

    const settings = await storage.getNotificationSettings(userId);
    const enabledChannels = this.getEnabledChannels(settings, channels, type);

    const now = new Date().toISOString();
    const notification: InsertNotification = {
      userId,
      type,
      title,
      message,
      data: data || null,
      channels: enabledChannels,
      read: false,
      readAt: null,
      emailSent: false,
      smsSent: false,
      pushSent: false,
      createdAt: now,
    };

    const created = await storage.createNotification(notification);

    const promises: Promise<void>[] = [];

    if (enabledChannels.includes('email') && settings?.email) {
      promises.push(this.sendEmail({
        to: settings.email,
        subject: title,
        html: this.formatEmailHtml(title, message, data),
        text: message,
      }).then(() => {
        storage.updateNotification(created.id, { emailSent: true });
      }).catch(console.error));
    }

    if (enabledChannels.includes('sms') && settings?.phone) {
      promises.push(this.sendSms({
        to: settings.phone,
        body: `${title}: ${message}`,
      }).then(() => {
        storage.updateNotification(created.id, { smsSent: true });
      }).catch(console.error));
    }

    if (enabledChannels.includes('push')) {
      promises.push(this.sendPushNotification(userId, title, message, data)
        .then(() => {
          storage.updateNotification(created.id, { pushSent: true });
        }).catch(console.error));
    }

    await Promise.allSettled(promises);
  }

  private getEnabledChannels(
    settings: NotificationSettings | null,
    requestedChannels: string[],
    type: string
  ): string[] {
    if (!settings) {
      return ['in_app'];
    }

    const channels: string[] = [];

    if (settings.inAppEnabled && requestedChannels.includes('in_app')) {
      channels.push('in_app');
    }

    if (settings.emailEnabled && requestedChannels.includes('email')) {
      if (this.isNotificationTypeEnabled(settings, type)) {
        channels.push('email');
      }
    }

    if (settings.smsEnabled && requestedChannels.includes('sms')) {
      if (this.isNotificationTypeEnabled(settings, type)) {
        channels.push('sms');
      }
    }

    if (settings.pushEnabled && requestedChannels.includes('push')) {
      if (this.isNotificationTypeEnabled(settings, type)) {
        channels.push('push');
      }
    }

    return channels.length > 0 ? channels : ['in_app'];
  }

  private isNotificationTypeEnabled(settings: NotificationSettings, type: string): boolean {
    if (type.includes('expense')) return settings.expenseNotifications;
    if (type.includes('payment')) return settings.paymentNotifications;
    if (type.includes('bill')) return settings.billNotifications;
    if (type.includes('budget')) return settings.budgetNotifications;
    if (type.includes('kyc') || type.includes('security')) return settings.securityNotifications;
    return true;
  }

  async sendEmail(config: EmailConfig): Promise<void> {
    const fromEmail = process.env.AWS_SES_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || 'noreply@spendly.app';
    const fromName = process.env.AWS_SES_FROM_NAME || 'Spendly';
    const formattedFrom = `${fromName} <${fromEmail}>`;

    // Use AWS SES if available
    if (this.emailProvider === 'aws' && this.sesClient) {
      try {
        const command = new SendEmailCommand({
          Source: formattedFrom,
          Destination: {
            ToAddresses: [config.to],
          },
          Message: {
            Subject: {
              Data: config.subject,
              Charset: 'UTF-8',
            },
            Body: {
              Html: {
                Data: config.html,
                Charset: 'UTF-8',
              },
              Text: {
                Data: config.text || config.html.replace(/<[^>]*>/g, ''),
                Charset: 'UTF-8',
              },
            },
          },
        });

        await this.sesClient.send(command);
        console.log('Email sent via AWS SES to:', config.to);
        return;
      } catch (error) {
        console.error('Failed to send email via AWS SES:', error);
        throw error;
      }
    }

    // Fallback to SendGrid
    if (this.emailProvider === 'sendgrid' && this.sendgridClient) {
      try {
        await this.sendgridClient.send({
          to: config.to,
          from: fromEmail,
          subject: config.subject,
          text: config.text || config.html.replace(/<[^>]*>/g, ''),
          html: config.html,
        });
        console.log('Email sent via SendGrid to:', config.to);
        return;
      } catch (error) {
        console.error('Failed to send email via SendGrid:', error);
        throw error;
      }
    }

    console.log('No email provider configured, skipping email:', config.subject);
  }

  async sendSms(config: SmsConfig): Promise<void> {
    // Use AWS SNS if available
    if (this.smsProvider === 'aws' && this.snsClient) {
      try {
        const command = new PublishCommand({
          PhoneNumber: config.to,
          Message: config.body,
          MessageAttributes: {
            'AWS.SNS.SMS.SenderID': {
              DataType: 'String',
              StringValue: process.env.AWS_SNS_SENDER_ID || 'Spendly',
            },
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
          },
        });

        await this.snsClient.send(command);
        console.log('SMS sent via AWS SNS to:', config.to);
        return;
      } catch (error) {
        console.error('Failed to send SMS via AWS SNS:', error);
        throw error;
      }
    }

    // Fallback to Twilio
    if (this.smsProvider === 'twilio' && this.twilioClient) {
      try {
        await this.twilioClient.messages.create({
          body: config.body,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: config.to,
        });
        console.log('SMS sent via Twilio to:', config.to);
        return;
      } catch (error) {
        console.error('Failed to send SMS via Twilio:', error);
        throw error;
      }
    }

    console.log('No SMS provider configured, skipping SMS:', config.body);
  }

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const tokens = await storage.getPushTokens(userId);
    
    if (!tokens || tokens.length === 0) {
      console.log('No push tokens for user:', userId);
      return;
    }

    for (const tokenRecord of tokens) {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: tokenRecord.token,
            title,
            body,
            data,
            sound: 'default',
          }),
        });

        if (!response.ok) {
          console.error('Push notification failed:', await response.text());
        } else {
          console.log('Push notification sent to:', tokenRecord.platform);
        }
      } catch (error) {
        console.error('Failed to send push notification:', error);
      }
    }
  }

  private formatEmailHtml(title: string, message: string, data?: Record<string, unknown>): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Spendly</h1>
            </div>
            <div style="padding: 32px;">
              <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">${title}</h2>
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">${message}</p>
              ${data?.actionUrl ? `
                <a href="${data.actionUrl}" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View Details</a>
              ` : ''}
            </div>
            <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                You received this email because you have notifications enabled for your Spendly account.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  async notifyExpenseSubmitted(userId: string, expense: { id: string; merchant: string; amount: number }): Promise<void> {
    await this.send({
      userId,
      type: 'expense_submitted',
      title: 'Expense Submitted',
      message: `Your expense of $${expense.amount} at ${expense.merchant} has been submitted for approval.`,
      data: { expenseId: expense.id, actionUrl: '/expenses' },
      channels: ['in_app', 'push'],
    });
  }

  async notifyExpenseApproved(userId: string, expense: { id: string; merchant: string; amount: number }): Promise<void> {
    await this.send({
      userId,
      type: 'expense_approved',
      title: 'Expense Approved',
      message: `Your expense of $${expense.amount} at ${expense.merchant} has been approved.`,
      data: { expenseId: expense.id, actionUrl: '/expenses' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyExpenseRejected(userId: string, expense: { id: string; merchant: string; amount: number; reason?: string }): Promise<void> {
    await this.send({
      userId,
      type: 'expense_rejected',
      title: 'Expense Rejected',
      message: `Your expense of $${expense.amount} at ${expense.merchant} was rejected. ${expense.reason ? `Reason: ${expense.reason}` : ''}`,
      data: { expenseId: expense.id, actionUrl: '/expenses' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyPaymentReceived(userId: string, payment: { amount: number; from: string; currency?: string }): Promise<void> {
    await this.send({
      userId,
      type: 'payment_received',
      title: 'Payment Received',
      message: `You received ${payment.currency || 'USD'} ${payment.amount} from ${payment.from}.`,
      data: { actionUrl: '/transactions' },
      channels: ['in_app', 'email', 'sms', 'push'],
    });
  }

  async notifyBillDue(userId: string, bill: { id: string; name: string; amount: number; dueDate: string }): Promise<void> {
    await this.send({
      userId,
      type: 'bill_due',
      title: 'Bill Due Soon',
      message: `Your ${bill.name} bill of $${bill.amount} is due on ${bill.dueDate}.`,
      data: { billId: bill.id, actionUrl: '/bills' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyBudgetWarning(userId: string, budget: { category: string; spent: number; limit: number; percentage: number }): Promise<void> {
    await this.send({
      userId,
      type: 'budget_warning',
      title: 'Budget Warning',
      message: `You've used ${budget.percentage}% of your ${budget.category} budget ($${budget.spent} of $${budget.limit}).`,
      data: { actionUrl: '/budget' },
      channels: ['in_app', 'push'],
    });
  }

  async notifyKycApproved(userId: string): Promise<void> {
    await this.send({
      userId,
      type: 'kyc_approved',
      title: 'Verification Approved',
      message: 'Congratulations! Your identity verification has been approved. You now have full access to all Spendly features.',
      data: { actionUrl: '/dashboard' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyKycRejected(userId: string, reason?: string): Promise<void> {
    await this.send({
      userId,
      type: 'kyc_rejected',
      title: 'Verification Rejected',
      message: `Your identity verification was rejected. ${reason ? `Reason: ${reason}` : 'Please resubmit with valid documents.'}`,
      data: { actionUrl: '/onboarding' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyCardTransaction(userId: string, transaction: { cardLast4: string; amount: number; merchant: string }): Promise<void> {
    await this.send({
      userId,
      type: 'card_transaction',
      title: 'Card Transaction',
      message: `$${transaction.amount} spent at ${transaction.merchant} using card ending in ${transaction.cardLast4}.`,
      data: { actionUrl: '/cards' },
      channels: ['in_app', 'push'],
    });
  }
}

export const notificationService = new NotificationService();
