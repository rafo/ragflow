import { useNavItemVisibility } from '@/hooks/use-nav-visibility';
import { PageContainer } from '@/layouts/components/page-container';
import { Applications } from './applications';
import { NextBanner } from './banner';
import { Datasets } from './datasets';
import { PrototypeHome, usePrototypeHomeContent } from './prototype-home';

const Home = () => {
  const { isNavItemVisible, isSuperuser } = useNavItemVisibility();
  const { content } = usePrototypeHomeContent(!isSuperuser);

  // Testers get the prototype status/help page; superusers (and any
  // deployment without a home.md) keep the upstream home.
  if (!isSuperuser && content) {
    return <PrototypeHome content={content} />;
  }

  return (
    <PageContainer>
      <article>
        <header className="mb-8">
          <NextBanner />
        </header>

        {isNavItemVisible('datasets') && <Datasets />}
        <Applications />
      </article>
    </PageContainer>
  );
};

export default Home;
