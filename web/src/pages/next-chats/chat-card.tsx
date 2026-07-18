import { HomeCard } from '@/components/home-card';
import { MoreButton } from '@/components/more-button';
import { SharedBadge } from '@/components/shared-badge';
import { useNavigatePage } from '@/hooks/logic-hooks/navigate-hooks';
import { useNavItemVisibility } from '@/hooks/use-nav-visibility';
import { IDialog } from '@/interfaces/database/chat';
import { ChatDropdown } from './chat-dropdown';
import { useRenameChat } from './hooks/use-rename-chat';

export type IProps = {
  data: IDialog;
  showPrivilegeModal(): void;
} & Pick<ReturnType<typeof useRenameChat>, 'showChatRenameModal'>;

export function ChatCard({
  data,
  showChatRenameModal,
  showPrivilegeModal,
}: IProps) {
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
          <ChatDropdown
            chat={data}
            showChatRenameModal={showChatRenameModal}
            showPrivilegeModal={showPrivilegeModal}
          >
            <MoreButton></MoreButton>
          </ChatDropdown>
        ) : undefined
      }
      sharedBadge={<SharedBadge>{data.nickname}</SharedBadge>}
      onClick={navigateToChat(data?.id)}
    />
  );
}
