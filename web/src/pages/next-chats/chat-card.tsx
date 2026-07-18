import { HomeCard } from '@/components/home-card';
import { MoreButton } from '@/components/more-button';
import { useNavigatePage } from '@/hooks/logic-hooks/navigate-hooks';
import { useNavItemVisibility } from '@/hooks/use-nav-visibility';
import { IDialog } from '@/interfaces/database/chat';
import { ChatDropdown } from './chat-dropdown';
import { useRenameChat } from './hooks/use-rename-chat';

export type IProps = {
  data: IDialog;
} & Pick<ReturnType<typeof useRenameChat>, 'showChatRenameModal'>;

export function ChatCard({ data, showChatRenameModal }: IProps) {
  const { navigateToChat } = useNavigatePage();
  // RE3: rename/delete are admin capabilities
  const { isSuperuser } = useNavItemVisibility();

  return (
    <HomeCard
      data={{
        name: data.name,
        description: data.description,
        avatar: data.icon,
        update_time: data.update_time,
      }}
      moreDropdown={
        isSuperuser ? (
          <ChatDropdown chat={data} showChatRenameModal={showChatRenameModal}>
            <MoreButton></MoreButton>
          </ChatDropdown>
        ) : undefined
      }
      onClick={navigateToChat(data?.id)}
    />
  );
}
