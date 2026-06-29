import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, EmptyState } from './feedback';

const meta: Meta<typeof Badge> = {
  title: 'Feedback/Badge',
  component: Badge,
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge tone="neutral">neutral</Badge>
      <Badge tone="success">success</Badge>
      <Badge tone="warning">warning</Badge>
      <Badge tone="danger">danger</Badge>
      <Badge tone="info">info</Badge>
      <Badge tone="dark">dark</Badge>
    </div>
  ),
};

export const Empty: StoryObj = {
  render: () => <EmptyState title="데이터가 없습니다" message="조건에 맞는 항목이 없어요." />,
};
