import { useNavItemVisibility } from '@/hooks/use-nav-visibility';
import { PageContainer } from '@/layouts/components/page-container';
import { Applications } from './applications';
import { NextBanner } from './banner';
import { Datasets } from './datasets';

const Home = () => {
  const { isNavItemVisible } = useNavItemVisibility();

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
