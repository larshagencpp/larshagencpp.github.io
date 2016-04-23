---
layout: post
title: "Fast incremental sort"
---

I recently came across the need for an incremental sorting algorithm, and started to wonder how to do it optimally. We'll see how branch misprediction and other constant factors can make the naive asymptotically optimal version far slower than a practical implementation.

The incremental sorting problem is described [here](https://en.wikipedia.org/wiki/Partial_sorting), and is an "online" version of partial sort. That is, if you have already sorted $$k$$ elements, you should be able to quickly sort $$k+1$$ elements, and so on.


**Use Cases**

Incremental sorts can be useful for a number of cases:

* You want sorted items, but you don't know how many elements you'll need.
	* This could often happen when you are filtering the resulting sequence, and you don't know how many items will be filtered out.
 * You are streaming the sequence, so even though you want the whole sequence, you want the first elements as quickly as possible.
 
**Measuring Performance**

Measuring the performance of an incremental sort is a bit more involved than full sort, because for a given $$N$$ we care about how fast we reach each $$k^{th}$$ element. To keep it simple, I'll keep $$N$$ fixed at 10 million, and measure the time taken to reach each $$k^{th}$$ element. The input range is a vector of random integers.

**Pre-Sorting**

Perhaps the simplest possible solution is pre-sorting the entire range, and then just using plain iterators to iterate over the sorted range.

{% highlight c++ %}
template<typename I>
class pre_sorter {
public:
  pre_sorter(I i1, I i2) : first(i1), last(i2) {
    std::sort(first, last);
  }

  I begin() { return first; }
  I end() { return last; }

private:
  I first;
  I last;
};
{% endhighlight %}

Unsurprisingly, the performance of this algorithm is virtually independent of $$k$$, as all the work is done at the start. This is obviously, not a good solution, but it's a nice reference point, especially when $$k$$ approaches $$N$$.

{% include plot.html divid="presortmsvc" csvpath="/project/incremental_sort/pre_sorter_msvc.csv" title="Pre-Sorting" ytitle="Time(ms)" suffix="ms" %}

**Partial Sorting**

To avoid doing all the sorting work up front, the next logical step is trying to use something like <code>std::partial_sort</code> to do the work. The idea is to to start by partially sorting a constant small part of the range and remember how much of the range is sorted. When you run out of sorted elements, do another partial sort.

Since a partial sort must look at all the remaining elements of the range, we can't keep partially sorting small ranges, that would lead to quadratic complexity. Instead, we multiply the number of elements to sort each time by some constant, giving us a logarithmic number of partial sorts.

{% highlight c++ %}
template<typename I>
class partial_sorter {
public:
  partial_sorter(I i1, I i2) : first(i1), last(i2) {}

  class iterator {
  public:
    ...
    iterator& operator++() {
      ensure_sorted_at_current();
      ++current;
      return *this;
    }

    value_type& operator*() {
      ensure_sorted_at_current();
      return *current;
    }

  private:
    void ensure_sorted_at_current() {
      if (current == sort_end) {
        sort_end = 
            sort_size < end - sort_end ?
            sort_end + sort_size :
            end;
        std::partial_sort(current, sort_end, end);
        sort_size *= 2;
      }
    }
    I current;
    I sort_end;
    I end;
    int sort_size = 100;
  };
  ...
};

{% endhighlight %}

This method is a huge improvement for small $$k$$, but it performs worse for $$k\gt$$ 1 million.

{% include plot.html divid="partialsortmsvc" csvpath="/project/incremental_sort/partial_sorter_msvc.csv" title="Partial Sorting" ytitle="Time(ms)" suffix="ms" %}

Since the <code>std::partial_sort</code> algortithm costs $$O(N \log k)$$, the $$O(\log N)$$ calls to <code>std::partial_sort</code> has a total worst case run time of $$O(N \log^2 N )$$. This means that in total we are doing more work than we should, time to fix this.

**Incremental Quicksort**

In a [paper](http://personales.dcc.uchile.cl/~raparede/publ/06alenexIQS.pdf) from 2006, Paredes and Navarro describes an algorithm which uses an incremental version of quicksort to achieve the optimal bound of $$O(N + k\log k)$$ for incremental sorting.

This method keeps a stack of partition points for the range. Each partition point is an iterator to a position in the range where everything before the position is smaller than everything after. The stack is sorted such that the top of the stack is the position closest to the start of the range.

This stack has the wonderful property that when you are looking for the next element in the sorted range, and your current position is not equal to the top of the stack, the next element must be between the current position and the top of the stack.

If the distance to the next partition point is large, you cut it in half with <code>std::partition</code>, and push the new partition point on the stack. If the distance is small, we can sort the small range with <code>std::sort</code>, and pop the element from the stack. A simple version is shown here:

{% highlight c++ %}
template<typename I>
class simple_quick_sorter {
public:
  simple_quick_sorter(I i1, I i2) : first(i1), last(i2) {}

  class iterator {
  public:
    ...
    iterator& operator++() {
      ensure_sorted_at_current();
      ++current;
      return *this;
    }

    value_type& operator*() {
      ensure_sorted_at_current();
      return *current;
    }

  private:
    void ensure_sorted_at_current() {
      if (current == sort_end) {
        while (stack.back() - sort_end > sort_limit) {
          auto range_size = stack.back() - current;
          value_type pivot = *(current + (mt() % range_size));
          auto it = std::partition(
            current,
            stack.back(),
            [=](const value_type& v) { return v < pivot; });
          while (it == current) {
            pivot = *(current + (mt() % range_size));
            it = std::partition(
              current,
              stack.back(),
              [=](const value_type& v) { return v < pivot; });
          }
          stack.push_back(it);
        }

        std::sort(sort_end, stack.back());
        sort_end = stack.back();
        stack.pop_back();
      }
    }
    I begin;
    I current;
    I sort_end;
    std::vector<I> stack;
    static const int sort_limit = 100;
    std::mt19937 mt{ std::random_device{}() };
  };
  ...
};
{% endhighlight %}

Looking at the results for this algorithm, it's clear that the total amount of work done when $$k=N$$ is now optimal,
because the time to sort the whole range is now as fast as a single call to <code>std::sort</code>. This has the benefit that you don't need to worry about switching over to <code>std::sort</code> if you know that you'll need a large part of the result, you can just use the incremental version anyway.

{% include plot.html divid="simplequicksortmsvc" csvpath="/project/incremental_sort/simple_quick_sorter_msvc.csv" title="Simple Quick Sorting" ytitle="Time(ms)" suffix="ms" %}

The downside of this algorithm, though, is that it does spend considerably more time than <code>std::partial_sort</code> coming up with the first few elements. If I need between 1 and 5000 elements, partial sorting is still the way to go by the looks of it. Why is that?

*Number of comparisons*

Even though <code>std::partial_sort</code> is only guaranteed to have $$O(N \log k)$$, a typical implementation will have closer to $$N$$ comparisons for small $$k$$ and random data. This is because the impementation typically makes a max heap of the first $$k$$ elements, and then walks through the rest of the range, inserting elements if they are smaller than the current max.

When $$k$$ is small, the elements in the heap will quickly become much smaller on average than most elements in the rest of the range, so insertions into the heap become less frequent as the range is processed. That means that for most of the elements in the range, the algorithm will just do a single comparison to verify that the element should not be in heap.

The incremental quick sort implementation, on the other hand, does a few more comparisons to find the first element. The first partition operation does $$N$$ comparisons to cut the range in two, the next partition takes $$\frac{N}{2}$$ comparisons to cut the first half down to a quarter, and so on. In total, it does about $$2\cdot N$$ comparisons to find the first element, twice that of a good partial sort. 

The difference in performance is much more than the difference in comparisons can explain, however, which brings us to the next point.

*Branch Mispredictions*

Few comparisons is not the only benefit of partial sort, it also has the benefit that most of the comparisons gives the same result. This gives a very fast inner loop, because it avoids [branch misprediction](https://en.wikipedia.org/wiki/Branch_misprediction).

For a partition operation that cuts the range in half, the number of branch mispredictions is at a peak, about every other comparison will be a misprediction. To verify that this was a big contributing factor, I tested <code>std::partition</code> with various pivot elements, that cut the range at various percentiles, to see the effect. I also compared with two hand-written loops (one normal branching and one branchless) to see that effect added up.

We see that partition speed is heavily impacted by the branch mispredictions, it seems to account for up to $$4x$$ difference in speed.

{% include plot.html divid="branch_prediction" csvpath="/project/incremental_sort/branch_prediction.csv" ytitle="Time(ms)" suffix="ms" %}

**Skewed Incremental Quick Sort**

After looking at the branch misprediction measurements, I realized that a balanced partition operation could not be the basis for an optimal incremental sort, but a skewed one could. If we skew the first partitions towards the beginning of the range, we get both fewer comparisons and branch mispredictions. The skew comes with a cost, however, as there is more work to do in total if we consistently get very skewed partitions. To counteract this effect, only the first partitions should be skewed. As we iterate further into the range, the partitions should be made less skewed, so we get about the right amount of work.

In the implementation of skewed incremental quicksort, I skewed the partitions by sampling a large number of pivots, sorting them, and choosing the pivot corresponding to the desired amount of skew.

{% highlight c++ %}
value_type get_pivot(int num_pivots, int pivot_idx) {
  assert(num_pivots <= 100);
  std::array<value_type, 100> pivots;
  for (int i = 0; i < num_pivots; ++i) {
	pivots[i] = *(current + (mt() % (stack.back() - current)));
  }

  std::sort(pivots.begin(), pivots.begin() + num_pivots);
  return pivots[pivot_idx];
}

value_type get_pivot() {
  auto range_size = stack.back() - current;

  if (range_size < 1000) {
	return get_pivot(3, 1);
  }

  double ratio = 
    (current - begin) / static_cast<double>(stack.back() - begin);

  if (range_size < 10'000) {
	int idx = ratio * 10;
	idx = std::min(idx, 5);
	idx = std::max(idx, 1);
	return get_pivot(10, idx);
  }
  
  int idx = ratio * 10;
  idx = std::min(idx, 50);
  idx = std::max(idx, 1);
  return get_pivot(100, idx);
}
{% endhighlight %}

 {% include plot.html divid="skewedquicksortmsvc" csvpath="/project/incremental_sort/skewed_quick_sorter_msvc.csv" title="Skewed Quick Sorting" ytitle="Time(ms)" suffix="ms" %}
 
**Summary**
 
 By combining the incremental quick sort algorithm with smart pivot selection, we can get an incremental sorting algorithm that is as fast as partial sort for small $$k$$, and as fast as full sort when $$k$$ approaches $$N$$.
 
 This is my first real blog post, so comments and suggestions are welcome!